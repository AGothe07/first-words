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
import { format } from "date-fns";

const investmentTypes = [
  { label: "Renda Fixa", value: "renda_fixa" },
  { label: "Ações", value: "acoes" },
  { label: "FII", value: "fii" },
  { label: "Cripto", value: "cripto" },
  { label: "Tesouro", value: "tesouro" },
  { label: "Outro", value: "outro" },
];

export default function InvestmentsScreen() {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Investment modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "renda_fixa", notes: "" });
  // Entry modal
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [entryForm, setEntryForm] = useState({ investment_id: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [invRes, entRes] = await Promise.all([
      supabase.from("investments").select("*").eq("user_id", user.id).order("name"),
      supabase.from("investment_entries").select("*").eq("user_id", user.id),
    ]);
    setInvestments(invRes.data || []);
    setEntries(entRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const totalByInvestment = (id: string) => entries.filter((e) => e.investment_id === id).reduce((s, e) => s + Number(e.amount), 0);
  const totalInvested = investments.reduce((s, inv) => s + totalByInvestment(inv.id), 0);

  // Distribution
  const distribution = investments.map((inv) => ({ name: inv.name, total: totalByInvestment(inv.id) })).sort((a, b) => b.total - a.total);
  const maxDist = distribution.length > 0 ? distribution[0].total : 1;

  const openAdd = () => { setEditingId(null); setForm({ name: "", type: "renda_fixa", notes: "" }); setModalVisible(true); };
  const openEdit = (inv: any) => { setEditingId(inv.id); setForm({ name: inv.name, type: inv.type, notes: inv.notes || "" }); setModalVisible(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert("Erro", "Preencha o nome"); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), type: form.type, notes: form.notes || null, user_id: user!.id };
    if (editingId) await supabase.from("investments").update(payload).eq("id", editingId);
    else await supabase.from("investments").insert(payload);
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleDelete = (inv: any) => {
    confirmDelete(inv.name, async () => {
      await supabase.from("investments").delete().eq("id", inv.id);
      fetchData();
    });
  };

  const openAddEntry = (invId: string) => {
    setEntryForm({ investment_id: invId, amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" });
    setEntryModalVisible(true);
  };

  const handleSaveEntry = async () => {
    if (!entryForm.amount) { Alert.alert("Erro", "Preencha o valor"); return; }
    setSaving(true);
    await supabase.from("investment_entries").insert({
      investment_id: entryForm.investment_id, amount: parseFloat(entryForm.amount),
      date: entryForm.date, notes: entryForm.notes || null, user_id: user!.id,
    });
    setSaving(false); setEntryModalVisible(false); fetchData();
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <Card style={styles.totalCard}>
        <Text style={[typography.kpiLabel, { color: colors.textSecondary }]}>Total Investido</Text>
        <Text style={[typography.h1, { color: colors.primary }]}>{fmt(totalInvested)}</Text>
      </Card>

      {distribution.length > 0 && (
        <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 8 }]}>Distribuição</Text>
          {distribution.slice(0, 6).map((d) => (
            <View key={d.name} style={styles.barRow}>
              <Text style={[typography.bodySmall, { color: colors.text, width: 90 }]} numberOfLines={1}>{d.name}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(d.total / maxDist) * 100}%` }]} />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, width: 80, textAlign: "right" }]}>{fmt(d.total)}</Text>
            </View>
          ))}
        </Card>
      )}

      <FlatList
        data={investments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const total = totalByInvestment(item.id);
          const entryCount = entries.filter((e) => e.investment_id === item.id).length;
          return (
            <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
              <Card style={styles.item}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>{item.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{item.type} • {entryCount} aportes</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[typography.body, { color: colors.primary, fontWeight: "600" }]}>{fmt(total)}</Text>
                    <TouchableOpacity onPress={() => openAddEntry(item.id)}><Text style={[typography.caption, { color: colors.primary }]}>+ Aporte</Text></TouchableOpacity>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhum investimento</Text></View>}
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Investimento" : "Novo Investimento"} onClose={() => setModalVisible(false)}>
        <Input label="Nome" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
        <Select label="Tipo" options={investmentTypes} value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))} />
        <Input label="Observações" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(investments.find(i => i.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>

      <ModalForm visible={entryModalVisible} title="Novo Aporte" onClose={() => setEntryModalVisible(false)}>
        <Input label="Valor" value={entryForm.amount} onChangeText={(v) => setEntryForm((f) => ({ ...f, amount: v }))} keyboardType="numeric" />
        <Input label="Data" placeholder="AAAA-MM-DD" value={entryForm.date} onChangeText={(v) => setEntryForm((f) => ({ ...f, date: v }))} />
        <Input label="Observações" value={entryForm.notes} onChangeText={(v) => setEntryForm((f) => ({ ...f, notes: v }))} multiline />
        <Button title="Adicionar Aporte" onPress={handleSaveEntry} loading={saving} />
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  totalCard: { margin: 16, marginBottom: 8, alignItems: "center" },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  empty: { alignItems: "center", marginTop: 60 },
});
