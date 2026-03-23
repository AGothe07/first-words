import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFilters } from "@/contexts/FiltersContext";
import { GlobalFiltersBar } from "@/components/ui/GlobalFiltersBar";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";

export default function InsightsScreen() {
  const { data, catMap, perMap, subMap, fmt, refresh } = useFilters();
  const { transactions, allTransactions, loading } = data;
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const now = new Date();
  const thisMonthTx = allTransactions.filter(t => { const d = parseISO(t.date); return d >= startOfMonth(now) && d <= endOfMonth(now); });
  const lastMonthTx = allTransactions.filter(t => { const d = parseISO(t.date); const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); });

  const thisExpense = thisMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const lastExpense = lastMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const thisIncome = thisMonthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

  // Category growth analysis
  const thisMonthCats = new Map<string, number>();
  const lastMonthCats = new Map<string, number>();
  thisMonthTx.filter(t => t.type === "expense").forEach(t => thisMonthCats.set(t.category_id, (thisMonthCats.get(t.category_id) || 0) + t.amount));
  lastMonthTx.filter(t => t.type === "expense").forEach(t => lastMonthCats.set(t.category_id, (lastMonthCats.get(t.category_id) || 0) + t.amount));

  const catGrowth = Array.from(thisMonthCats.entries()).map(([id, val]) => {
    const prev = lastMonthCats.get(id) || 0;
    return { id, name: catMap.get(id) || "?", current: val, previous: prev, growth: prev > 0 ? ((val - prev) / prev) * 100 : 100 };
  }).sort((a, b) => b.growth - a.growth);

  // Filtered period insights (matching web InsightsPanel logic)
  const filteredIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const filteredExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const savingsRate = filteredIncome > 0 ? ((filteredIncome - filteredExpense) / filteredIncome * 100) : 0;

  // Generate insights exactly like web InsightsPanel
  const insights = useMemo(() => {
    const result: { icon: string; color: string; text: string }[] = [];
    const expenses = transactions.filter(t => t.type === "expense");
    const incomes = transactions.filter(t => t.type === "income");
    const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
    const totalInc = incomes.reduce((s, t) => s + t.amount, 0);

    if (transactions.length === 0) {
      result.push({ icon: "💡", color: colors.primary, text: "Comece adicionando lançamentos para ver insights automáticos." });
      return result;
    }

    if (totalExp > totalInc && totalInc > 0) {
      result.push({ icon: "⚠️", color: colors.destructive, text: `Gastos (${fmt(totalExp)}) superam receitas (${fmt(totalInc)}) em ${fmt(totalExp - totalInc)}.` });
    } else if (totalInc > totalExp && totalInc > 0) {
      const pct = (((totalInc - totalExp) / totalInc) * 100).toFixed(0);
      result.push({ icon: "✅", color: colors.success, text: `Você está economizando ${pct}% da receita neste período.` });
    }

    const byCat: Record<string, { name: string; total: number }> = {};
    expenses.forEach(t => {
      if (!byCat[t.category_id]) byCat[t.category_id] = { name: catMap.get(t.category_id) || "?", total: 0 };
      byCat[t.category_id].total += t.amount;
    });
    const sorted = Object.values(byCat).sort((a, b) => b.total - a.total);
    if (sorted.length > 0) {
      const pct = totalExp > 0 ? ((sorted[0].total / totalExp) * 100).toFixed(0) : "0";
      result.push({ icon: "📊", color: colors.primary, text: `"${sorted[0].name}" é sua maior categoria de gastos, representando ${pct}% do total.` });
    }

    const byPerson: Record<string, { name: string; total: number }> = {};
    expenses.forEach(t => {
      if (!byPerson[t.person_id]) byPerson[t.person_id] = { name: perMap.get(t.person_id) || "?", total: 0 };
      byPerson[t.person_id].total += t.amount;
    });
    const topPerson = Object.values(byPerson).sort((a, b) => b.total - a.total);
    if (topPerson.length > 1) {
      result.push({ icon: "👤", color: colors.primary, text: `"${topPerson[0].name}" é quem mais gastou: ${fmt(topPerson[0].total)} (${((topPerson[0].total / totalExp) * 100).toFixed(0)}% do total).` });
    }

    if (expenses.length > 0) {
      const biggest = expenses.reduce((max, t) => t.amount > max.amount ? t : max, expenses[0]);
      result.push({ icon: "💸", color: colors.warning, text: `Maior gasto individual: ${fmt(biggest.amount)} em "${subMap.get(biggest.subcategory_id) || catMap.get(biggest.category_id) || "?"}" (${perMap.get(biggest.person_id) || "?"}).` });
    }

    return result;
  }, [transactions, catMap, perMap, subMap, fmt]);

  const monthlyInsights: string[] = [];
  if (thisExpense > lastExpense && lastExpense > 0) monthlyInsights.push(`⚠️ Despesas aumentaram ${((thisExpense - lastExpense) / lastExpense * 100).toFixed(0)}% vs mês anterior`);
  if (thisExpense < lastExpense && lastExpense > 0) monthlyInsights.push(`✅ Despesas reduziram ${((lastExpense - thisExpense) / lastExpense * 100).toFixed(0)}% vs mês anterior`);
  if (thisIncome > 0 && thisExpense > thisIncome) monthlyInsights.push(`🔴 Gastando mais do que ganha neste mês`);
  if (thisIncome > 0 && thisExpense < thisIncome * 0.5) monthlyInsights.push(`💚 Economizando mais de 50% da receita`);
  const avgDaily = thisExpense / Math.max(now.getDate(), 1);
  monthlyInsights.push(`📊 Média diária de gastos: ${fmt(avgDaily)}`);
  if (savingsRate > 0) monthlyInsights.push(`💰 Taxa de poupança (período filtrado): ${savingsRate.toFixed(1)}%`);

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Text style={[typography.h2, { color: colors.text }]}>💡 Insights Financeiros</Text>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 4 }]}>Análise automática das suas finanças</Text>

      <GlobalFiltersBar />

      {/* Insights Automáticos - matching web InsightsPanel */}
      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>💡 Insights Automáticos</Text>
        {insights.map((ins, i) => (
          <View key={i} style={styles.insightRow}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>{ins.icon}</Text>
            <Text style={[typography.body, { color: colors.text, flex: 1, lineHeight: 20 }]}>{ins.text}</Text>
          </View>
        ))}
      </Card>

      {/* Comparativo Mensal */}
      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>Comparativo Mensal</Text>
        <View style={styles.compareRow}>
          <View style={styles.compareBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Mês anterior</Text>
            <Text style={[typography.body, { color: colors.expense, fontWeight: "700" }]}>{fmt(lastExpense)}</Text>
          </View>
          <Text style={{ fontSize: 20, color: colors.textMuted }}>→</Text>
          <View style={styles.compareBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Mês atual</Text>
            <Text style={[typography.body, { color: colors.expense, fontWeight: "700" }]}>{fmt(thisExpense)}</Text>
          </View>
        </View>
        {lastExpense > 0 && (
          <View style={[styles.variationBadge, { backgroundColor: thisExpense > lastExpense ? `${colors.destructive}15` : `${colors.success}15` }]}>
            <Text style={[typography.bodySmall, { color: thisExpense > lastExpense ? colors.destructive : colors.success, fontWeight: "600" }]}>
              {thisExpense > lastExpense ? "↑" : "↓"} {Math.abs(((thisExpense - lastExpense) / lastExpense) * 100).toFixed(1)}%
            </Text>
          </View>
        )}
      </Card>

      {/* Monthly diagnostics */}
      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>Diagnóstico Mensal</Text>
        {monthlyInsights.map((insight, i) => (
          <View key={i} style={styles.diagRow}>
            <Text style={[typography.body, { color: colors.text }]}>{insight}</Text>
          </View>
        ))}
      </Card>

      {/* Category growth */}
      {catGrowth.length > 0 && (
        <Card style={styles.section}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>Categorias em Crescimento</Text>
          {catGrowth.slice(0, 5).map(c => (
            <View key={c.id} style={styles.growthRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text }]}>{c.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{fmt(c.previous)} → {fmt(c.current)}</Text>
              </View>
              <View style={[styles.growthBadge, { backgroundColor: c.growth > 0 ? `${colors.destructive}15` : `${colors.success}15` }]}>
                <Text style={[typography.bodySmall, { color: c.growth > 0 ? colors.destructive : colors.success, fontWeight: "600" }]}>
                  {c.growth > 0 ? "↑" : "↓"} {Math.abs(c.growth).toFixed(0)}%
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Period summary */}
      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>Resumo do Período Filtrado</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Receitas</Text>
            <Text style={[typography.kpiValue, { color: colors.income, fontSize: 18 }]}>{fmt(filteredIncome)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Despesas</Text>
            <Text style={[typography.kpiValue, { color: colors.expense, fontSize: 18 }]}>{fmt(filteredExpense)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Saldo</Text>
            <Text style={[typography.kpiValue, { color: filteredIncome - filteredExpense >= 0 ? colors.success : colors.destructive, fontSize: 18 }]}>{fmt(filteredIncome - filteredExpense)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Transações</Text>
            <Text style={[typography.kpiValue, { color: colors.text, fontSize: 18 }]}>{transactions.length}</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginBottom: 12 },
  insightRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${colors.border}60` },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  compareBox: { flex: 1, alignItems: "center", padding: 8, backgroundColor: colors.background, borderRadius: 8 },
  variationBadge: { alignSelf: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  diagRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${colors.border}60` },
  growthRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${colors.border}60` },
  growthBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryCell: { width: "47%", backgroundColor: colors.background, borderRadius: 8, padding: 10, alignItems: "center" },
});
