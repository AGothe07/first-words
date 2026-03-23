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

const emptyForm = { title: "", event_date: format(new Date(), "yyyy-MM-dd"), event_type: "birthday", person_name: "", phone: "", notes: "", is_recurring: "true" };

export default function EventsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("important_events").select("*").eq("user_id", user.id).order("event_date", { ascending: true });
    setEvents(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalVisible(true); };
  const openEdit = (e: any) => {
    setEditingId(e.id);
    setForm({ title: e.title, event_date: e.event_date, event_type: e.event_type, person_name: e.person_name || "", phone: e.phone || "", notes: e.notes || "", is_recurring: String(e.is_recurring ?? true) });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert("Erro", "Preencha o título"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(), event_date: form.event_date, event_type: form.event_type,
      person_name: form.person_name || null, phone: form.phone || null, notes: form.notes || null,
      is_recurring: form.is_recurring === "true", user_id: user!.id,
    };
    if (editingId) await supabase.from("important_events").update(payload).eq("id", editingId);
    else await supabase.from("important_events").insert(payload);
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleDelete = (e: any) => {
    confirmDelete(e.title, async () => {
      await supabase.from("important_events").delete().eq("id", e.id);
      fetchData();
    });
  };

  const typeIcon = (t: string) => { switch (t) { case "birthday": return "🎂"; case "anniversary": return "💍"; default: return "📅"; } };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
            <Card style={styles.item}>
              <View style={styles.row}>
                <Text style={{ fontSize: 24 }}>{typeIcon(item.event_type)}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>{item.title}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {format(parseISO(item.event_date), "dd/MM/yyyy")}
                    {item.person_name ? ` • ${item.person_name}` : ""}
                  </Text>
                  {item.notes ? <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{item.notes}</Text> : null}
                </View>
                {item.is_recurring && <Text style={{ fontSize: 14 }}>🔄</Text>}
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhuma data importante</Text></View>}
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Evento" : "Novo Evento"} onClose={() => setModalVisible(false)}>
        <Input label="Título" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
        <Input label="Data" placeholder="AAAA-MM-DD" value={form.event_date} onChangeText={(v) => setForm((f) => ({ ...f, event_date: v }))} />
        <Select label="Tipo" options={[{ label: "🎂 Aniversário", value: "birthday" }, { label: "💍 Aniversário de Casamento", value: "anniversary" }, { label: "📅 Outro", value: "other" }]} value={form.event_type} onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))} />
        <Input label="Pessoa" value={form.person_name} onChangeText={(v) => setForm((f) => ({ ...f, person_name: v }))} />
        <Input label="Telefone" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
        <Select label="Recorrente" options={[{ label: "Sim", value: "true" }, { label: "Não", value: "false" }]} value={form.is_recurring} onValueChange={(v) => setForm((f) => ({ ...f, is_recurring: v }))} />
        <Input label="Observações" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(events.find(e => e.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  empty: { alignItems: "center", marginTop: 60 },
});
