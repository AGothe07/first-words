import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/contexts/FiltersContext";
import { GlobalFiltersBar } from "@/components/ui/GlobalFiltersBar";
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

const emptyForm = { type: "expense", date: format(new Date(), "yyyy-MM-dd"), amount: "", notes: "", category_id: "", person_id: "", subcategory_id: "", payment_method_id: "", account_id: "", project_id: "" };

export default function TransactionsScreen() {
  const { user } = useAuth();
  const { data, catMap, perMap, fmt, refresh } = useFilters();
  const { transactions, categories, persons, loading } = data;
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  // KPI summary
  const summary = useMemo(() => {
    let income = 0, expense = 0;
    transactions.forEach((t) => { if (t.type === "income") income += t.amount; else expense += t.amount; });
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalVisible(true); };
  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      type: t.type, date: t.date, amount: String(t.amount),
      notes: t.notes || "", category_id: t.category_id, person_id: t.person_id,
      subcategory_id: t.subcategory_id || "", payment_method_id: t.payment_method_id || "",
      account_id: t.account_id || "", project_id: t.project_id || "",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.category_id || !form.person_id) {
      Alert.alert("Erro", "Preencha valor, categoria e pessoa");
      return;
    }
    setSaving(true);
    const payload = {
      type: form.type, date: form.date, amount: parseFloat(form.amount),
      notes: form.notes || null, category_id: form.category_id, person_id: form.person_id,
      subcategory_id: form.subcategory_id || null, payment_method_id: form.payment_method_id || null,
      account_id: form.account_id || null, project_id: form.project_id || null,
      user_id: user!.id,
    };
    if (editingId) {
      const { error } = await supabase.from("transactions").update(payload).eq("id", editingId);
      if (error) Alert.alert("Erro", error.message);
    } else {
      const { error } = await supabase.from("transactions").insert(payload);
      if (error) Alert.alert("Erro", error.message);
    }
    setSaving(false);
    setModalVisible(false);
    refresh();
  };

  const handleDelete = (t: any) => {
    confirmDelete(catMap.get(t.category_id) || "lançamento", async () => {
      await supabase.from("transactions").delete().eq("id", t.id);
      refresh();
    });
  };

  const filteredCats = categories.filter((c) => c.type === form.type);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
      <Card style={styles.item}>
        <View style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.text }]}>{catMap.get(item.category_id) || "?"}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {perMap.get(item.person_id) || "?"} • {format(parseISO(item.date), "dd/MM/yyyy")}
            </Text>
            {item.notes ? <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{item.notes}</Text> : null}
          </View>
          <Text style={[typography.body, { fontWeight: "600", color: item.type === "income" ? colors.income : colors.expense }]}>
            {item.type === "income" ? "+" : "-"}{fmt(item.amount)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      {/* Summary KPIs */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[typography.caption, { color: colors.income }]}>Receitas</Text>
          <Text style={[typography.bodySmall, { color: colors.income, fontWeight: "700" }]}>{fmt(summary.income)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[typography.caption, { color: colors.expense }]}>Despesas</Text>
          <Text style={[typography.bodySmall, { color: colors.expense, fontWeight: "700" }]}>{fmt(summary.expense)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Saldo</Text>
          <Text style={[typography.bodySmall, { color: summary.balance >= 0 ? colors.success : colors.destructive, fontWeight: "700" }]}>{fmt(summary.balance)}</Text>
        </View>
      </View>

      <GlobalFiltersBar />

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhum lançamento</Text></View>
        }
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Lançamento" : "Novo Lançamento"} onClose={() => setModalVisible(false)}>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, form.type === "expense" && { backgroundColor: colors.expense }]}
            onPress={() => setForm((f) => ({ ...f, type: "expense", category_id: "" }))}
          >
            <Text style={[styles.typeText, form.type === "expense" && { color: "#fff" }]}>Despesa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, form.type === "income" && { backgroundColor: colors.income }]}
            onPress={() => setForm((f) => ({ ...f, type: "income", category_id: "" }))}
          >
            <Text style={[styles.typeText, form.type === "income" && { color: "#fff" }]}>Receita</Text>
          </TouchableOpacity>
        </View>
        <Input label="Valor" placeholder="0.00" value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="numeric" />
        <Input label="Data" placeholder="AAAA-MM-DD" value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} />
        <Select label="Categoria" options={filteredCats.map((c) => ({ label: c.name, value: c.id }))} value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))} />
        <Select label="Pessoa" options={persons.map((p) => ({ label: p.name, value: p.id }))} value={form.person_id} onValueChange={(v) => setForm((f) => ({ ...f, person_id: v }))} />
        <Input label="Observações" placeholder="Opcional" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
        <Button title={editingId ? "Salvar" : "Adicionar"} onPress={handleSave} loading={saving} />
        {editingId && (
          <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(transactions.find(t => t.id === editingId)!); }} style={{ marginTop: 8 }} />
        )}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  summaryItem: { flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 4 },
  itemRow: { flexDirection: "row", alignItems: "center" },
  empty: { alignItems: "center", marginTop: 60 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  typeText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
});
