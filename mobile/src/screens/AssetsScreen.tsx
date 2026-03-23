import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FAB } from "@/components/ui/FAB";
import { ModalForm } from "@/components/ui/ModalForm";
import { confirmDelete } from "@/components/ui/ConfirmDialog";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { format } from "date-fns";

export default function AssetsScreen() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "", value: "", date: format(new Date(), "yyyy-MM-dd") });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("assets").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setAssets(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const totals = assets.reduce((acc: Record<string, number>, a: any) => {
    if (!acc[a.category]) acc[a.category] = Number(a.value);
    return acc;
  }, {});
  const totalPatrimony = Object.values(totals).reduce((s: number, v: number) => s + v, 0);

  // Distribution for simple chart
  const distribution = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const maxDist = distribution.length > 0 ? distribution[0][1] : 1;

  const openAdd = () => { setEditingId(null); setForm({ category: "", value: "", date: format(new Date(), "yyyy-MM-dd") }); setModalVisible(true); };
  const openEdit = (a: any) => { setEditingId(a.id); setForm({ category: a.category, value: String(a.value), date: a.date }); setModalVisible(true); };

  const handleSave = async () => {
    if (!form.category || !form.value) { Alert.alert("Erro", "Preencha categoria e valor"); return; }
    setSaving(true);
    const payload = { category: form.category, value: parseFloat(form.value), date: form.date, user_id: user!.id };
    if (editingId) await supabase.from("assets").update(payload).eq("id", editingId);
    else await supabase.from("assets").insert(payload);
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleDelete = (a: any) => {
    confirmDelete(a.category, async () => {
      await supabase.from("assets").delete().eq("id", a.id);
      fetchData();
    });
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <Card style={styles.totalCard}>
        <Text style={[typography.kpiLabel, { color: colors.textSecondary }]}>Patrimônio Total</Text>
        <Text style={[typography.h1, { color: colors.primary }]}>{fmt(totalPatrimony)}</Text>
      </Card>

      {distribution.length > 0 && (
        <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 8 }]}>Distribuição</Text>
          {distribution.map(([cat, val]) => (
            <View key={cat} style={styles.barRow}>
              <Text style={[typography.bodySmall, { color: colors.text, width: 90 }]} numberOfLines={1}>{cat}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(val / maxDist) * 100}%` }]} />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, width: 80, textAlign: "right" }]}>{fmt(val)}</Text>
            </View>
          ))}
        </Card>
      )}

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
            <Card style={styles.item}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>{item.category}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{item.date}</Text>
                </View>
                <Text style={[typography.body, { color: colors.primary, fontWeight: "600" }]}>{fmt(Number(item.value))}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhum ativo</Text></View>}
      />
      <FAB onPress={openAdd} />
      <ModalForm visible={modalVisible} title={editingId ? "Editar Ativo" : "Novo Ativo"} onClose={() => setModalVisible(false)}>
        <Input label="Categoria" placeholder="Ex: Imóvel, Veículo..." value={form.category} onChangeText={(v) => setForm((f) => ({ ...f, category: v }))} />
        <Input label="Valor" value={form.value} onChangeText={(v) => setForm((f) => ({ ...f, value: v }))} keyboardType="numeric" />
        <Input label="Data" placeholder="AAAA-MM-DD" value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(assets.find(a => a.id === editingId)!); }} style={{ marginTop: 8 }} />}
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
