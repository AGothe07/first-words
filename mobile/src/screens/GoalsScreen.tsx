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

const emptyForm = { title: "", description: "", target_value: "", current_value: "", unit: "", target_date: "", status: "active", priority: "medium" };

export default function GoalsScreen() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setGoals(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalVisible(true); };
  const openEdit = (g: any) => {
    setEditingId(g.id);
    setForm({
      title: g.title, description: g.description || "", target_value: String(g.target_value || ""),
      current_value: String(g.current_value || ""), unit: g.unit || "", target_date: g.target_date || "",
      status: g.status, priority: g.priority || "medium",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert("Erro", "Preencha o título"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(), description: form.description || null,
      target_value: form.target_value ? parseFloat(form.target_value) : null,
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      unit: form.unit || null, target_date: form.target_date || null,
      status: form.status, priority: form.priority, user_id: user!.id,
    };
    if (editingId) {
      await supabase.from("goals").update(payload).eq("id", editingId);
    } else {
      await supabase.from("goals").insert(payload);
    }
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleDelete = (g: any) => {
    confirmDelete(g.title, async () => {
      await supabase.from("goals").delete().eq("id", g.id);
      fetchData();
    });
  };

  const getProgress = (g: any) => {
    if (!g.target_value || g.target_value === 0) return 0;
    return Math.min(100, ((g.current_value || 0) / g.target_value) * 100);
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const progress = getProgress(item);
          return (
            <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
              <Card style={styles.item}>
                <View style={styles.row}>
                  <Text style={[typography.body, { color: colors.text, flex: 1, fontWeight: "600" }]}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === "completed" ? colors.success + "20" : item.status === "paused" ? colors.warning + "20" : colors.primary + "20" }]}>
                    <Text style={[typography.caption, { color: item.status === "completed" ? colors.success : item.status === "paused" ? colors.warning : colors.primary }]}>
                      {item.status === "completed" ? "Concluída" : item.status === "paused" ? "Pausada" : "Ativa"}
                    </Text>
                  </View>
                </View>
                {item.description ? <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={2}>{item.description}</Text> : null}
                {item.target_value ? (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progress >= 100 ? colors.success : colors.primary }]} />
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {(item.current_value || 0).toLocaleString("pt-BR")} / {item.target_value.toLocaleString("pt-BR")} {item.unit || ""} ({progress.toFixed(0)}%)
                    </Text>
                  </View>
                ) : null}
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhuma meta</Text></View>}
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Meta" : "Nova Meta"} onClose={() => setModalVisible(false)}>
        <Input label="Título" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
        <Input label="Descrição" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
        <Input label="Valor Alvo" placeholder="0" value={form.target_value} onChangeText={(v) => setForm((f) => ({ ...f, target_value: v }))} keyboardType="numeric" />
        <Input label="Valor Atual" placeholder="0" value={form.current_value} onChangeText={(v) => setForm((f) => ({ ...f, current_value: v }))} keyboardType="numeric" />
        <Input label="Unidade" placeholder="R$, kg, etc" value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} />
        <Input label="Data Alvo" placeholder="AAAA-MM-DD" value={form.target_date} onChangeText={(v) => setForm((f) => ({ ...f, target_date: v }))} />
        <Select label="Status" options={[{ label: "Ativa", value: "active" }, { label: "Pausada", value: "paused" }, { label: "Concluída", value: "completed" }]} value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))} />
        <Select label="Prioridade" options={[{ label: "Baixa", value: "low" }, { label: "Média", value: "medium" }, { label: "Alta", value: "high" }]} value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))} />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(goals.find(g => g.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  progressContainer: { marginTop: 8 },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", borderRadius: 3 },
  empty: { alignItems: "center", marginTop: 60 },
});
