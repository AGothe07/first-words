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

export default function CategoriesScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "expense" });
  const [saving, setSaving] = useState(false);
  // Subcategory
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [subForm, setSubForm] = useState({ name: "", category_id: "" });
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [catRes, subRes] = await Promise.all([
      supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
      supabase.from("subcategories").select("*").eq("user_id", user.id).order("name"),
    ]);
    setCategories(catRes.data || []);
    setSubcategories(subRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const openAdd = () => { setEditingId(null); setForm({ name: "", type: "expense" }); setModalVisible(true); };
  const openEdit = (c: any) => { setEditingId(c.id); setForm({ name: c.name, type: c.type }); setModalVisible(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert("Erro", "Preencha o nome"); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), type: form.type, user_id: user!.id };
    if (editingId) {
      await supabase.from("categories").update(payload).eq("id", editingId);
    } else {
      await supabase.from("categories").insert(payload);
    }
    setSaving(false); setModalVisible(false); fetchData();
  };

  const handleToggleActive = async (c: any) => {
    await supabase.from("categories").update({ is_active: !c.is_active }).eq("id", c.id);
    fetchData();
  };

  const handleDelete = (c: any) => {
    confirmDelete(c.name, async () => {
      const { error } = await supabase.from("categories").delete().eq("id", c.id);
      if (error) Alert.alert("Erro", "Categoria em uso, não pode ser excluída");
      else fetchData();
    });
  };

  // Subcategory handlers
  const openAddSub = (catId: string) => { setEditingSubId(null); setSubForm({ name: "", category_id: catId }); setSubModalVisible(true); };
  const handleSaveSub = async () => {
    if (!subForm.name.trim()) { Alert.alert("Erro", "Preencha o nome"); return; }
    setSaving(true);
    if (editingSubId) {
      await supabase.from("subcategories").update({ name: subForm.name.trim() }).eq("id", editingSubId);
    } else {
      await supabase.from("subcategories").insert({ name: subForm.name.trim(), category_id: subForm.category_id, user_id: user!.id });
    }
    setSaving(false); setSubModalVisible(false); fetchData();
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const subs = subcategories.filter((s) => s.category_id === item.id);
          return (
            <TouchableOpacity onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
              <Card style={[styles.item, !item.is_active && { opacity: 0.5 }]}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>{item.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {item.type === "expense" ? "Despesa" : "Receita"} {!item.is_active && "• Inativa"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity onPress={() => handleToggleActive(item)}>
                      <Text style={{ fontSize: 16 }}>{item.is_active ? "✅" : "⬜"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openAddSub(item.id)}>
                      <Text style={{ fontSize: 16 }}>➕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {subs.length > 0 && (
                  <View style={styles.subList}>
                    {subs.map((s) => (
                      <View key={s.id} style={styles.subItem}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>↳ {s.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Text style={[typography.body, { color: colors.textMuted }]}>Nenhuma categoria</Text></View>}
      />
      <FAB onPress={openAdd} />

      <ModalForm visible={modalVisible} title={editingId ? "Editar Categoria" : "Nova Categoria"} onClose={() => setModalVisible(false)}>
        <Input label="Nome" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
        <Select label="Tipo" options={[{ label: "Despesa", value: "expense" }, { label: "Receita", value: "income" }]} value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))} />
        <Button title="Salvar" onPress={handleSave} loading={saving} />
      </ModalForm>

      <ModalForm visible={subModalVisible} title="Nova Subcategoria" onClose={() => setSubModalVisible(false)}>
        <Input label="Nome" value={subForm.name} onChangeText={(v) => setSubForm((f) => ({ ...f, name: v }))} />
        <Button title="Salvar" onPress={handleSaveSub} loading={saving} />
      </ModalForm>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  item: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  subList: { marginTop: 8, marginLeft: 12, gap: 4 },
  subItem: { paddingVertical: 2 },
  empty: { alignItems: "center", marginTop: 60 },
});
