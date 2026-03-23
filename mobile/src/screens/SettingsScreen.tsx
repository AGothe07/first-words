import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || "");
        setPhone(data.phone || "");
      }
    });
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, phone }).eq("id", user!.id);
    if (error) Alert.alert("Erro", error.message);
    else Alert.alert("Sucesso", "Perfil atualizado!");
    setSaving(false);
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja realmente sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>👤 Perfil</Text>
        <Input label="Nome de Exibição" value={displayName} onChangeText={setDisplayName} />
        <Input label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button title="Salvar Perfil" onPress={handleSaveProfile} loading={saving} />
      </Card>

      <Card>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>📧 Conta</Text>
        <View style={styles.infoRow}>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Email</Text>
          <Text style={[typography.bodySmall, { color: colors.text }]}>{user?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>ID</Text>
          <Text style={[typography.bodySmall, { color: colors.text }]} numberOfLines={1}>{user?.id}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Criado em</Text>
          <Text style={[typography.bodySmall, { color: colors.text }]}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "—"}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>ℹ️ App</Text>
        <View style={styles.infoRow}>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Versão</Text>
          <Text style={[typography.bodySmall, { color: colors.text }]}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Plataforma</Text>
          <Text style={[typography.bodySmall, { color: colors.text }]}>React Native + Expo</Text>
        </View>
      </Card>

      <Button title="Sair da Conta" variant="destructive" onPress={handleLogout} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
});
