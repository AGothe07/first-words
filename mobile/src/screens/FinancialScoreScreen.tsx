import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useFilters } from "@/contexts/FiltersContext";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

export default function FinancialScoreScreen() {
  const { user } = useAuth();
  const { data, fmt } = useFilters();
  const { allTransactions, loading } = data;
  const [budgets, setBudgets] = React.useState<any[]>([]);
  const [debts, setDebts] = React.useState<any[]>([]);
  const [goals, setGoals] = React.useState<any[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [extraLoading, setExtraLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("budgets").select("*").eq("user_id", user.id),
      supabase.from("debts").select("*").eq("user_id", user.id),
      supabase.from("goals").select("*").eq("user_id", user.id),
    ]).then(([b, d, g]) => {
      setBudgets(b.data || []);
      setDebts(d.data || []);
      setGoals(g.data || []);
      setExtraLoading(false);
    });
  }, [user]);

  const onRefresh = async () => { setRefreshing(true); setRefreshing(false); };

  const score = useMemo(() => {
    const now = new Date();
    const monthTx = allTransactions.filter(t => { const d = parseISO(t.date); return d >= startOfMonth(now) && d <= endOfMonth(now); });
    const income = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    let points = 50;
    if (income > 0) {
      const rate = (income - expense) / income;
      if (rate >= 0.3) points += 20;
      else if (rate >= 0.1) points += 10;
      else if (rate < 0) points -= 15;
    }
    if (budgets.length > 0) points += 5;
    const activeDebts = debts.filter(d => d.status !== "paid");
    if (activeDebts.length === 0) points += 15;
    else if (activeDebts.length <= 2) points += 5;
    else points -= 10;
    if (goals.filter(g => g.status === "completed").length > 0) points += 10;
    return Math.max(0, Math.min(100, points));
  }, [allTransactions, budgets, debts, goals]);

  const scoreColor = score >= 80 ? colors.success : score >= 50 ? colors.warning : colors.destructive;
  const scoreLabel = score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Precisa Melhorar";

  const criteria = [
    { label: "Taxa de Poupança", desc: "Receita vs despesas do mês", icon: "💰" },
    { label: "Controle Orçamentário", desc: `${budgets.length} orçamentos definidos`, icon: "🐷" },
    { label: "Gestão de Dívidas", desc: `${debts.filter(d => d.status !== "paid").length} dívidas ativas`, icon: "🏦" },
    { label: "Metas Alcançadas", desc: `${goals.filter(g => g.status === "completed").length}/${goals.length} metas`, icon: "🎯" },
  ];

  if (loading || extraLoading) return <Loading />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Text style={[typography.h2, { color: colors.text }]}>🏆 Score Financeiro</Text>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 16 }]}>Avaliação da sua saúde financeira</Text>

      <Card style={[styles.scoreCard, { borderColor: scoreColor }]}>
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[{ fontSize: 42, fontWeight: "800", color: scoreColor }]}>{score}</Text>
        </View>
        <Text style={[typography.h3, { color: scoreColor, marginTop: 8 }]}>{scoreLabel}</Text>
        <View style={styles.scoreBar}>
          <View style={[styles.scoreFill, { width: `${score}%`, backgroundColor: scoreColor }]} />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>Critérios de Avaliação</Text>
        {criteria.map((c, i) => (
          <View key={i} style={styles.criteriaRow}>
            <Text style={{ fontSize: 20 }}>{c.icon}</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[typography.body, { color: colors.text, fontWeight: "600" }]}>{c.label}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{c.desc}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>💡 Dicas</Text>
        {score < 60 && <Text style={[typography.body, { color: colors.text, marginBottom: 8 }]}>• Tente definir orçamentos para suas categorias principais</Text>}
        {debts.filter(d => d.status !== "paid").length > 2 && <Text style={[typography.body, { color: colors.text, marginBottom: 8 }]}>• Foque em quitar dívidas com juros mais altos primeiro</Text>}
        {goals.filter(g => g.status === "completed").length === 0 && <Text style={[typography.body, { color: colors.text, marginBottom: 8 }]}>• Defina metas financeiras e acompanhe o progresso</Text>}
        <Text style={[typography.body, { color: colors.text }]}>• Mantenha uma taxa de poupança acima de 20%</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  scoreCard: { alignItems: "center", marginBottom: 16, borderWidth: 2, borderRadius: 16, padding: 24 },
  scoreCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, justifyContent: "center", alignItems: "center" },
  scoreBar: { width: "100%", height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden", marginTop: 12 },
  scoreFill: { height: "100%", borderRadius: 4 },
  section: { marginBottom: 12 },
  criteriaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
});
