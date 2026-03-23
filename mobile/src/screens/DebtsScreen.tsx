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

const emptyForm = { creditor: "", total_value: "", remaining_value: "", installments: "1", installments_paid: "0", interest_rate: "0", status: "active", notes: "" };

export default function DebtsScreen() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("debts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setDebts(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalVisible(true); };
  const openEdit = (d: any) => {
    setEditingId(d.id);
    setForm({
      creditor: d.creditor, total_value: String(d.total_value), remaining_value: String(d.remaining_value),
      installments: String(d.installments), installments_paid: String(d.installments_paid),
      interest_rate: String(d.interest_rate), status: d.status, notes: d.notes || "",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.creditor || !form.total_value) { Alert.alert("Erro", "Preencha credor e valor total"); return; }
    setSaving(true);
    const payload = {
      creditor: form.creditor, total_value: parseFloat(form.total_value), remaining_value: parseFloat(form.remaining_value || form.total_value),
      installments: parseInt(form.installments) || 1, installments_paid: parseInt(form.installments_paid) || 0,
      interest_rate: parseFloat(form.interest_rate) || 0, status: form.status, notes: form.notes || null, user_id: user!.id,
    };
    if (editingId) await supabase.from("debts").update(payload).eq("id", editingId);
    else await supabase.from("debts").insert(payload);
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleDelete = (d: any) => {
    confirmDelete(d.creditor, async () => {
      await supabase.from("debts").delete().eq("id", d.id);
      fetchData();
    });
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const totalDebt = debts.filter(d => d.status !== "paid").reduce((s, d) => s + Number(d.remaining_value), 0);

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <Card style={{ margin: 16, marginBottom: 0, alignItems: "center" }}>
        <Text style={[typography.kpiLabel, { color: colors.textSecondary }]}>Total em Dívidas</Text>
        <Text style={[typography.h1, { color: colors.destructive }]}>{fmt(totalDebt)}</Text>
      </Card>
      <FlatList
        data={debts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const total = Number(item.total_value);
          const remaining = Number(item.remaining_value);
          const paid = total - remaining;
          const pct = total > 0 ? (paid / total) * 100 : 0;
          const isPaid = item.status === "paid";
          return (
            <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
              <Card style={[styles.item, isPaid && { opacity: 0.6 }]}>
                <View style={styles.row}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: "600", flex: 1 }]}>{item.creditor}</Text>
                  <View style={[styles.badge, { backgroundColor: isPaid ? colors.success + "20" : colors.destructive + "20" }]}>
                    <Text style={[typography.caption, { color: isPaid ? colors.success : colors.destructive }]}>{isPaid ? "Quitada" : "Ativa"}</Text>
                  </View>
                </View>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: isPaid ? colors.success : colors.primary }]} /></View>
                <View style={styles.row}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{fmt(paid)} pago</Text>
                  <Text style={[typography.caption, { color: remaining > 0 ? colors.destructive : colors.success }]}>{remaining > 0 ? `${fmt(remaining)} restante` : "Quitada!"}</Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                  {item.installments_paid}/{item.installments} parcelas • Juros: {item.interest_rate}%
                </Text>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhuma dívida</Text></View>}
      />
      <FAB onPress={openAdd} />
      <ModalForm visible={modalVisible} title={editingId ? "Editar Dívida" : "Nova Dívida"} onClose={() => setModalVisible(false)}>
        <Input label="Credor" value={form.creditor} onChangeText={(v) => setForm((f) => ({ ...f, creditor: v }))} />
        <Input label="Valor Total" value={form.total_value} onChangeText={(v) => setForm((f) => ({ ...f, total_value: v }))} keyboardType="numeric" />
        <Input label="Valor Restante" value={form.remaining_value} onChangeText={(v) => setForm((f) => ({ ...f, remaining_value: v }))} keyboardType="numeric" />
        <Input label="Total de Parcelas" value={form.installments} onChangeText={(v) => setForm((f) => ({ ...f, installments: v }))} keyboardType="numeric" />
        <Input label="Parcelas Pagas" value={form.installments_paid} onChangeText={(v) => setForm((f) => ({ ...f, installments_paid: v }))} keyboardType="numeric" />
        <Input label="Taxa de Juros (%)" value={form.interest_rate} onChangeText={(v) => setForm((f) => ({ ...f, interest_rate: v }))} keyboardType="numeric" />
        <Select label="Status" options={[{ label: "Ativa", value: "active" }, { label: "Quitada", value: "paid" }]} value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))} />
        <Input label="Observações" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(debts.find(d => d.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginVertical: 8 },
  progressFill: { height: "100%", borderRadius: 3 },
  empty: { alignItems: "center", marginTop: 60 },
});
