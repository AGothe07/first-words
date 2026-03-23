import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FAB } from "@/components/ui/FAB";
import { ModalForm } from "@/components/ui/ModalForm";
import { confirmDelete } from "@/components/ui/ConfirmDialog";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { format, parseISO } from "date-fns";

export default function RecurringScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "expense", amount: "", category_id: "", person_id: "", frequency: "monthly", next_due_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [recRes, catRes, perRes] = await Promise.all([
      supabase.from("recurring_transactions").select("*").eq("user_id", user.id).order("next_due_date"),
      supabase.from("categories").select("id, name, type").eq("user_id", user.id).eq("is_active", true).order("name"),
      supabase.from("persons").select("id, name").eq("user_id", user.id).eq("is_active", true).order("name"),
    ]);
    setItems(recRes.data || []);
    setCategories(catRes.data || []);
    setPersons(perRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const perMap = new Map(persons.map((p) => [p.id, p.name]));
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const freqLabel = (f: string) => { switch (f) { case "daily": return "Diária"; case "weekly": return "Semanal"; case "monthly": return "Mensal"; case "yearly": return "Anual"; default: return f; } };

  const openAdd = () => { setEditingId(null); setForm({ type: "expense", amount: "", category_id: "", person_id: "", frequency: "monthly", next_due_date: format(new Date(), "yyyy-MM-dd"), notes: "" }); setModalVisible(true); };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({ type: r.type, amount: String(r.amount), category_id: r.category_id, person_id: r.person_id, frequency: r.frequency, next_due_date: r.next_due_date, notes: r.notes || "" });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.category_id || !form.person_id) { Alert.alert("Erro", "Preencha os campos obrigatórios"); return; }
    setSaving(true);
    const payload = {
      type: form.type, amount: parseFloat(form.amount), category_id: form.category_id, person_id: form.person_id,
      frequency: form.frequency, next_due_date: form.next_due_date, notes: form.notes || null, user_id: user!.id,
    };
    if (editingId) await supabase.from("recurring_transactions").update(payload).eq("id", editingId);
    else await supabase.from("recurring_transactions").insert(payload);
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleToggleActive = async (r: any) => {
    await supabase.from("recurring_transactions").update({ is_active: !r.is_active }).eq("id", r.id);
    fetchData();
  };

  const handleDelete = (r: any) => {
    confirmDelete(catMap.get(r.category_id) || "recorrência", async () => {
      await supabase.from("recurring_transactions").delete().eq("id", r.id);
      fetchData();
    });
  };

  const filteredCats = categories.filter((c) => c.type === form.type);

  const totalMonthly = items.filter(i => i.is_active && i.frequency === "monthly").reduce((s, i) => s + Number(i.amount), 0);

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <Card style={{ margin: 16, marginBottom: 0, alignItems: "center" }}>
        <Text style={[typography.kpiLabel, { color: colors.textSecondary }]}>Total Mensal Recorrente</Text>
        <Text style={[typography.h1, { color: colors.primary }]}>{fmt(totalMonthly)}</Text>
      </Card>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
            <Card style={[styles.item, !item.is_active && { opacity: 0.5 }]}>
              <View style={styles.row}>
                <TouchableOpacity onPress={() => handleToggleActive(item)} style={{ marginRight: 8 }}>
                  <Text style={{ fontSize: 16 }}>{item.is_active ? "✅" : "⬜"}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>{catMap.get(item.category_id) || "?"}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {perMap.get(item.person_id) || "?"} • {freqLabel(item.frequency)}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Próximo: {format(parseISO(item.next_due_date), "dd/MM/yyyy")}</Text>
                </View>
                <Text style={[typography.body, { color: item.type === "income" ? colors.income : colors.expense, fontWeight: "600" }]}>{fmt(Number(item.amount))}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhuma recorrência</Text></View>}
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Recorrência" : "Nova Recorrência"} onClose={() => setModalVisible(false)}>
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, form.type === "expense" && { backgroundColor: colors.expense }]} onPress={() => setForm((f) => ({ ...f, type: "expense", category_id: "" }))}>
            <Text style={[styles.typeText, form.type === "expense" && { color: "#fff" }]}>Despesa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, form.type === "income" && { backgroundColor: colors.income }]} onPress={() => setForm((f) => ({ ...f, type: "income", category_id: "" }))}>
            <Text style={[styles.typeText, form.type === "income" && { color: "#fff" }]}>Receita</Text>
          </TouchableOpacity>
        </View>
        <Input label="Valor" value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="numeric" />
        <Select label="Categoria" options={filteredCats.map((c) => ({ label: c.name, value: c.id }))} value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))} />
        <Select label="Pessoa" options={persons.map((p) => ({ label: p.name, value: p.id }))} value={form.person_id} onValueChange={(v) => setForm((f) => ({ ...f, person_id: v }))} />
        <Select label="Frequência" options={[{ label: "Diária", value: "daily" }, { label: "Semanal", value: "weekly" }, { label: "Mensal", value: "monthly" }, { label: "Anual", value: "yearly" }]} value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))} />
        <Input label="Próxima Data" placeholder="AAAA-MM-DD" value={form.next_due_date} onChangeText={(v) => setForm((f) => ({ ...f, next_due_date: v }))} />
        <Input label="Observações" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(items.find(i => i.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  typeText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  empty: { alignItems: "center", marginTop: 60 },
});
