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

const emptyForm = { title: "", description: "", start_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"), priority: "medium", item_type: "task", all_day: "false", color: "#0D9488" };

export default function AgendaScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("agenda_items").select("*").eq("user_id", user.id).order("start_date", { ascending: true });
    setItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const filteredItems = items.filter((i) => {
    if (filter === "pending") return i.status !== "done";
    if (filter === "done") return i.status === "done";
    return true;
  });

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalVisible(true); };
  const openEdit = (i: any) => {
    setEditingId(i.id);
    setForm({ title: i.title, description: i.description || "", start_date: i.start_date, priority: i.priority || "medium", item_type: i.item_type || "task", all_day: String(i.all_day || false), color: i.color || "#0D9488" });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert("Erro", "Preencha o título"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(), description: form.description || null, start_date: form.start_date,
      priority: form.priority, item_type: form.item_type, all_day: form.all_day === "true",
      color: form.color, user_id: user!.id,
    };
    if (editingId) await supabase.from("agenda_items").update(payload).eq("id", editingId);
    else await supabase.from("agenda_items").insert(payload);
    setSaving(false); setModalVisible(false); fetchData();
  };

  const toggleStatus = async (item: any) => {
    const newStatus = item.status === "done" ? "pending" : "done";
    await supabase.from("agenda_items").update({ status: newStatus }).eq("id", item.id);
    fetchData();
  };

  const handleDelete = (i: any) => {
    confirmDelete(i.title, async () => {
      await supabase.from("agenda_items").delete().eq("id", i.id);
      fetchData();
    });
  };

  const priorityColor = (p: string) => {
    switch (p) { case "high": return colors.destructive; case "low": return colors.success; default: return colors.warning; }
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(["all", "pending", "done"] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : "Concluídos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
            <Card style={[styles.item, item.status === "done" && { opacity: 0.5 }]}>
              <View style={styles.row}>
                <TouchableOpacity onPress={() => toggleStatus(item)} style={{ marginRight: 10 }}>
                  <Text style={{ fontSize: 18 }}>{item.status === "done" ? "☑️" : "⬜"}</Text>
                </TouchableOpacity>
                <View style={[styles.dot, { backgroundColor: item.color || colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: "600", textDecorationLine: item.status === "done" ? "line-through" : "none" }]}>{item.title}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {format(parseISO(item.start_date), "dd/MM/yyyy HH:mm")}
                    {item.all_day ? " (Dia inteiro)" : ""}
                  </Text>
                  {item.description ? <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{item.description}</Text> : null}
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: priorityColor(item.priority) + "20" }]}>
                  <Text style={[typography.caption, { color: priorityColor(item.priority) }]}>
                    {item.priority === "high" ? "Alta" : item.priority === "low" ? "Baixa" : "Média"}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhum item na agenda</Text></View>}
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Item" : "Novo Item"} onClose={() => setModalVisible(false)}>
        <Input label="Título" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
        <Input label="Descrição" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
        <Input label="Data/Hora" placeholder="AAAA-MM-DDTHH:MM" value={form.start_date} onChangeText={(v) => setForm((f) => ({ ...f, start_date: v }))} />
        <Select label="Tipo" options={[{ label: "Tarefa", value: "task" }, { label: "Evento", value: "event" }, { label: "Lembrete", value: "reminder" }]} value={form.item_type} onValueChange={(v) => setForm((f) => ({ ...f, item_type: v }))} />
        <Select label="Prioridade" options={[{ label: "Baixa", value: "low" }, { label: "Média", value: "medium" }, { label: "Alta", value: "high" }]} value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))} />
        <Select label="Dia Inteiro" options={[{ label: "Sim", value: "true" }, { label: "Não", value: "false" }]} value={form.all_day} onValueChange={(v) => setForm((f) => ({ ...f, all_day: v }))} />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(items.find(i => i.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 0 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: "500", color: colors.textSecondary },
  filterTextActive: { color: "#fff" },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  empty: { alignItems: "center", marginTop: 60 },
});
