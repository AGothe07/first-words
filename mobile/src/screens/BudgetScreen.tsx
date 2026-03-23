import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function BudgetScreen() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category_id: "", amount: "" });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [budgetRes, txRes, catRes] = await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("category_id, amount, type").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd),
      supabase.from("categories").select("id, name, type").eq("user_id", user.id).eq("type", "expense").eq("is_active", true).order("name"),
    ]);
    setBudgets(budgetRes.data || []);
    setTransactions(txRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t: any) => { if (t.type === "expense") map.set(t.category_id, (map.get(t.category_id) || 0) + Number(t.amount)); });
    return map;
  }, [transactions]);
  const catMap = useMemo(() => new Map(categories.map((c: any) => [c.id, c.name])), [categories]);
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + (spentByCategory.get(b.category_id) || 0), 0);

  const openAdd = () => { setEditingId(null); setForm({ category_id: "", amount: "" }); setModalVisible(true); };
  const openEdit = (b: any) => { setEditingId(b.id); setForm({ category_id: b.category_id, amount: String(b.amount) }); setModalVisible(true); };

  const handleSave = async () => {
    if (!form.category_id || !form.amount) { Alert.alert("Erro", "Preencha todos os campos"); return; }
    setSaving(true);
    const payload = { category_id: form.category_id, amount: parseFloat(form.amount), period: "monthly", user_id: user!.id };
    if (editingId) await supabase.from("budgets").update(payload).eq("id", editingId);
    else await supabase.from("budgets").insert(payload);
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleDelete = (b: any) => {
    confirmDelete(catMap.get(b.category_id) || "orçamento", async () => {
      await supabase.from("budgets").delete().eq("id", b.id);
      fetchData();
    });
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <Card style={{ margin: 16, marginBottom: 0 }}>
        <View style={styles.summaryRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.kpiLabel, { color: colors.textSecondary }]}>Orçamento Total</Text>
            <Text style={[typography.kpiValue, { color: colors.primary }]}>{fmt(totalBudget)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.kpiLabel, { color: colors.textSecondary }]}>Gasto Total</Text>
            <Text style={[typography.kpiValue, { color: totalSpent > totalBudget ? colors.destructive : colors.text }]}>{fmt(totalSpent)}</Text>
          </View>
        </View>
      </Card>
      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const spent = spentByCategory.get(item.category_id) || 0;
          const limit = Number(item.amount);
          const pct = limit > 0 ? (spent / limit) * 100 : 0;
          const remaining = limit - spent;
          return (
            <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
              <Card style={styles.item}>
                <View style={styles.row}><Text style={[typography.body, { color: colors.text, fontWeight: "600", flex: 1 }]}>{catMap.get(item.category_id) || "?"}</Text><Text style={[typography.bodySmall, { color: pct > 100 ? colors.destructive : pct > 80 ? colors.warning : colors.textMuted, fontWeight: "700" }]}>{pct.toFixed(0)}%</Text></View>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: pct > 100 ? colors.destructive : pct > 80 ? colors.warning : colors.primary }]} /></View>
                <View style={styles.row}><Text style={[typography.caption, { color: colors.textMuted }]}>{fmt(spent)} gasto</Text><Text style={[typography.caption, { color: remaining < 0 ? colors.destructive : colors.textMuted }]}>{remaining >= 0 ? `${fmt(remaining)} disponível` : `${fmt(Math.abs(remaining))} acima`}</Text></View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhum orçamento definido</Text></View>}
      />
      <FAB onPress={openAdd} />
      <ModalForm visible={modalVisible} title={editingId ? "Editar Orçamento" : "Novo Orçamento"} onClose={() => setModalVisible(false)}>
        <Select label="Categoria" options={categories.map((c) => ({ label: c.name, value: c.id }))} value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))} />
        <Input label="Valor Limite" placeholder="0.00" value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="numeric" />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(budgets.find(b => b.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryRow: { flexDirection: "row", gap: 16 },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginVertical: 8 },
  progressFill: { height: "100%", borderRadius: 3 },
  empty: { alignItems: "center", marginTop: 60 },
});
