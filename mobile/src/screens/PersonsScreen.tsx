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

export default function PersonsScreen() {
  const { user } = useAuth();
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("persons").select("*").eq("user_id", user.id).order("name");
    setPersons(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const openAdd = () => { setEditingId(null); setForm({ name: "" }); setModalVisible(true); };
  const openEdit = (p: any) => { setEditingId(p.id); setForm({ name: p.name }); setModalVisible(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert("Erro", "Preencha o nome"); return; }
    setSaving(true);
    if (editingId) await supabase.from("persons").update({ name: form.name.trim() }).eq("id", editingId);
    else await supabase.from("persons").insert({ name: form.name.trim(), user_id: user!.id });
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleToggleActive = async (p: any) => {
    await supabase.from("persons").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchData();
  };

  const handleDelete = (p: any) => {
    confirmDelete(p.name, async () => {
      const { error } = await supabase.from("persons").delete().eq("id", p.id);
      if (error) Alert.alert("Erro", "Pessoa em uso, não pode ser excluída");
      else fetchData();
    });
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <FlatList
        data={persons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
            <Card style={[styles.item, !item.is_active && { opacity: 0.5 }]}>
              <View style={styles.row}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{item.is_active ? "Ativa" : "Inativa"}</Text>
                </View>
                <TouchableOpacity onPress={() => handleToggleActive(item)}>
                  <Text style={{ fontSize: 16 }}>{item.is_active ? "✅" : "⬜"}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhuma pessoa</Text></View>}
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Pessoa" : "Nova Pessoa"} onClose={() => setModalVisible(false)}>
        <Input label="Nome" value={form.name} onChangeText={(v) => setForm({ name: v })} />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
        {editingId && <Button title="Excluir" variant="destructive" onPress={() => { setModalVisible(false); handleDelete(persons.find(p => p.id === editingId)!); }} style={{ marginTop: 8 }} />}
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  empty: { alignItems: "center", marginTop: 60 },
});
