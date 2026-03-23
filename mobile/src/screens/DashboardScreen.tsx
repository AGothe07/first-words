import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useFilters } from "@/contexts/FiltersContext";
import { GlobalFiltersBar } from "@/components/ui/GlobalFiltersBar";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, differenceInDays, subDays, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dashboardBlueprint } from "@/config/dashboardBlueprint";

type AvgMode = "daily" | "weekly" | "monthly";
const avgLabels: Record<AvgMode, string> = { daily: "Diária", weekly: "Semanal", monthly: "Mensal" };
const avgOrder: AvgMode[] = ["daily", "weekly", "monthly"];

type TransactionViewType = "expense" | "income";

export default function DashboardScreen() {
  const {
    data, filters, catMap, perMap, subMap, pmMap, accMap, projMap, fmt, refresh,
    setCategoryId, setPersonId, setSubcategoryId, toggleChartSelection,
    chartSelection, removeChartSelection, clearChartSelection, isDimensionActive,
  } = useFilters();
  const { transactions, allTransactions, loading } = data;
  const [refreshing, setRefreshing] = React.useState(false);
  const [avgMode, setAvgMode] = useState<AvgMode>("daily");
  const [catViewType, setCatViewType] = useState<TransactionViewType>("expense");
  const [rankViewType, setRankViewType] = useState<TransactionViewType>("expense");
  const [subViewType, setSubViewType] = useState<TransactionViewType>("expense");

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const selectionLabel: Record<string, string> = {
    category: "Categoria", person: "Pessoa", type: "Tipo",
    subcategory: "Subcategoria", payment_method: "Forma de Pagamento",
    account: "Conta", project: "Projeto",
  };

  // === KPIs (matching web KPICards) ===
  const kpi = useMemo(() => {
    let income = 0, expense = 0;
    transactions.forEach((t) => {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    });
    const balance = income - expense;

    // Previous month comparison
    const now = new Date();
    const pm = subMonths(now, 1);
    const prevExpenses = allTransactions
      .filter((t) => t.type === "expense" && parseISO(t.date) >= startOfMonth(pm) && parseISO(t.date) <= endOfMonth(pm))
      .reduce((s, t) => s + t.amount, 0);
    const variation = prevExpenses > 0 ? ((expense - prevExpenses) / prevExpenses) * 100 : 0;

    // Calendar days for average calc
    let calendarDays = 1;
    const now2 = new Date();
    const getRange = (preset: string) => {
      switch (preset) {
        case "7d": return { from: subDays(now2, 7), to: now2 };
        case "30d": return { from: subDays(now2, 30), to: now2 };
        case "month": return { from: startOfMonth(now2), to: endOfMonth(now2) };
        case "year": return { from: startOfYear(now2), to: now2 };
        default: return null;
      }
    };
    if (filters.period === "all" || filters.period === "upto_month") {
      if (transactions.length > 0) {
        const dates = transactions.map(t => t.date).sort();
        calendarDays = differenceInDays(parseISO(dates[dates.length - 1]), parseISO(dates[0])) + 1;
      }
    } else {
      const range = getRange(filters.period);
      if (range) calendarDays = differenceInDays(range.to, range.from) + 1;
    }
    if (calendarDays < 1) calendarDays = 1;

    return {
      income, expense, balance, variation,
      avgDaily: balance / calendarDays,
      avgWeekly: balance / Math.max(calendarDays / 7, 1),
      avgMonthly: balance / Math.max(calendarDays / 30, 1),
      count: transactions.length,
    };
  }, [transactions, allTransactions, filters.period]);

  const avgValue = avgMode === "daily" ? kpi.avgDaily : avgMode === "weekly" ? kpi.avgWeekly : kpi.avgMonthly;
  const cycleAvgMode = () => setAvgMode(prev => avgOrder[(avgOrder.indexOf(prev) + 1) % avgOrder.length]);

  // === Category Pie data (matching web CategoryChart) ===
  const categoryData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; id: string }>();
    transactions.filter(t => t.type === catViewType).forEach(t => {
      const existing = map.get(t.category_id) || { name: catMap.get(t.category_id) || "?", value: 0, id: t.category_id };
      existing.value += t.amount;
      map.set(t.category_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [transactions, catMap, catViewType]);
  const catTotal = categoryData.reduce((s, d) => s + d.value, 0);

  // === Category Ranking (matching web CategoryRankingChart) ===
  const rankingData = useMemo(() => {
    const map = new Map<string, { name: string; total: number; id: string }>();
    transactions.filter(t => t.type === rankViewType).forEach(t => {
      const existing = map.get(t.category_id) || { name: catMap.get(t.category_id) || "?", total: 0, id: t.category_id };
      existing.total += t.amount;
      map.set(t.category_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [transactions, catMap, rankViewType]);
  const maxRanking = rankingData.length > 0 ? rankingData[0].total : 1;

  // === Subcategory data (matching web SubcategoryChart) ===
  const subcategoryData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; id: string; catName: string; count: number }>();
    transactions.filter(t => t.type === subViewType && t.subcategory_id).forEach(t => {
      const existing = map.get(t.subcategory_id) || {
        name: subMap.get(t.subcategory_id) || "?", value: 0, id: t.subcategory_id,
        catName: catMap.get(t.category_id) || "?", count: 0,
      };
      existing.value += t.amount;
      existing.count++;
      map.set(t.subcategory_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [transactions, subMap, catMap, subViewType]);
  const subTotal = subcategoryData.reduce((s, d) => s + d.value, 0);
  const maxSub = subcategoryData.length > 0 ? subcategoryData[0].value : 1;

  // === Top Persons (matching web PersonChart) ===
  const topPersons = useMemo(() => {
    const map = new Map<string, { name: string; expenses: number; incomes: number; id: string }>();
    transactions.forEach(t => {
      const existing = map.get(t.person_id) || { name: perMap.get(t.person_id) || "?", expenses: 0, incomes: 0, id: t.person_id };
      if (t.type === "expense") existing.expenses += t.amount;
      else existing.incomes += t.amount;
      map.set(t.person_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.expenses - a.expenses);
  }, [transactions, perMap]);
  const maxPer = topPersons.length > 0 ? topPersons[0].expenses : 1;

  // === Person Timeline (matching web PersonTimelineChart) ===
  const personTimeline = useMemo(() => {
    const topIds = topPersons.slice(0, 3).map(p => p.id);
    const rows = new Map<string, Record<string, number>>();
    transactions.forEach(t => {
      if (t.type !== "expense" || !topIds.includes(t.person_id)) return;
      const month = format(parseISO(t.date), "yyyy-MM");
      const row = rows.get(month) || {};
      row[t.person_id] = (row[t.person_id] || 0) + t.amount;
      rows.set(month, row);
    });
    return Array.from(rows.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
      .map(([month, values]) => ({ month, values }));
  }, [transactions, topPersons]);

  // === Monthly Timeline with granularity (matching web SpendingTimelineChart) ===
  const monthlyTimeline = useMemo(() => {
    const months = new Map<string, { income: number; expense: number; count: number }>();
    transactions.forEach(t => {
      const key = format(parseISO(t.date), "yyyy-MM");
      const m = months.get(key) || { income: 0, expense: 0, count: 0 };
      if (t.type === "income") m.income += t.amount;
      else m.expense += t.amount;
      m.count++;
      months.set(key, m);
    });
    return Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => ({
        month: key,
        label: format(parseISO(key + "-01"), "MMM/yy", { locale: ptBR }),
        ...val,
        balance: val.income - val.expense,
      }));
  }, [transactions]);
  const maxTimeline = Math.max(...monthlyTimeline.map(m => Math.max(m.income, m.expense)), 1);

  // === Dynamic dimensions (matching web DimensionChart) ===
  const dimensionCharts = useMemo(() => {
    const configs = [
      { key: "payment_method" as const, title: "Forma de Pagamento", map: pmMap, field: "payment_method_id" },
      { key: "account" as const, title: "Conta / Cartão", map: accMap, field: "account_id" },
      { key: "project" as const, title: "Projeto", map: projMap, field: "project_id" },
    ];
    return configs.filter(c => isDimensionActive(c.key)).map(cfg => {
      const values = new Map<string, number>();
      transactions.forEach(t => {
        const id = (t as any)[cfg.field];
        if (!id) return;
        values.set(id, (values.get(id) || 0) + t.amount);
      });
      const items = Array.from(values.entries())
        .map(([id, amount]) => ({ id, name: cfg.map.get(id) || "?", value: amount }))
        .sort((a, b) => b.value - a.value);
      const total = items.reduce((s, i) => s + i.value, 0);
      return { key: cfg.key, title: cfg.title, items, total };
    });
  }, [transactions, pmMap, accMap, projMap, isDimensionActive]);

  // === Cumulative Balance (matching web CumulativeBalanceChart) ===
  const cumulativeBalance = useMemo(() => {
    let balance = 0;
    return monthlyTimeline.map(m => {
      balance += m.balance;
      return { month: m.month, label: m.label, balance: Math.round(balance * 100) / 100 };
    });
  }, [monthlyTimeline]);
  const maxBalance = Math.max(...cumulativeBalance.map(b => Math.abs(b.balance)), 1);
  const lastBalance = cumulativeBalance.length > 0 ? cumulativeBalance[cumulativeBalance.length - 1].balance : 0;

  // === Weekday Spending (matching web WeekdayChart) ===
  const weekdaySpending = useMemo(() => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const totals = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    transactions.filter(t => t.type === "expense").forEach(t => {
      const d = parseISO(t.date).getDay();
      totals[d] += t.amount;
      counts[d]++;
    });
    return days.map((name, i) => ({ name, total: totals[i], avg: counts[i] > 0 ? Math.round((totals[i] / counts[i]) * 100) / 100 : 0 }));
  }, [transactions]);
  const maxWeekday = Math.max(...weekdaySpending.map(w => w.avg), 1);

  // === Insights (matching web InsightsPanel) ===
  const insights = useMemo(() => {
    const result: string[] = [];
    const expenses = transactions.filter(t => t.type === "expense");
    const incomes = transactions.filter(t => t.type === "income");
    const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
    const totalInc = incomes.reduce((s, t) => s + t.amount, 0);

    if (transactions.length === 0) {
      result.push("💡 Comece adicionando lançamentos para ver insights automáticos.");
      return result;
    }

    if (totalExp > totalInc && totalInc > 0) {
      result.push(`⚠️ Gastos (${fmt(totalExp)}) superam receitas (${fmt(totalInc)}) em ${fmt(totalExp - totalInc)}.`);
    } else if (totalInc > totalExp && totalInc > 0) {
      result.push(`✅ Você está economizando ${(((totalInc - totalExp) / totalInc) * 100).toFixed(0)}% da receita neste período.`);
    }

    const byCat: Record<string, { name: string; total: number }> = {};
    expenses.forEach(t => {
      if (!byCat[t.category_id]) byCat[t.category_id] = { name: catMap.get(t.category_id) || "?", total: 0 };
      byCat[t.category_id].total += t.amount;
    });
    const sortedCats = Object.values(byCat).sort((a, b) => b.total - a.total);
    if (sortedCats.length > 0) {
      const pct = totalExp > 0 ? ((sortedCats[0].total / totalExp) * 100).toFixed(0) : "0";
      result.push(`📊 "${sortedCats[0].name}" é sua maior categoria de gastos, representando ${pct}% do total.`);
    }

    const byPerson: Record<string, { name: string; total: number }> = {};
    expenses.forEach(t => {
      if (!byPerson[t.person_id]) byPerson[t.person_id] = { name: perMap.get(t.person_id) || "?", total: 0 };
      byPerson[t.person_id].total += t.amount;
    });
    const topPerson = Object.values(byPerson).sort((a, b) => b.total - a.total);
    if (topPerson.length > 1) {
      result.push(`👤 "${topPerson[0].name}" é quem mais gastou: ${fmt(topPerson[0].total)} (${((topPerson[0].total / totalExp) * 100).toFixed(0)}% do total).`);
    }

    if (expenses.length > 0) {
      const biggest = expenses.reduce((max, t) => t.amount > max.amount ? t : max, expenses[0]);
      result.push(`💸 Maior gasto individual: ${fmt(biggest.amount)} em "${subMap.get(biggest.subcategory_id) || catMap.get(biggest.category_id) || "?"}" (${perMap.get(biggest.person_id) || "?"}).`);
    }
    return result;
  }, [transactions, catMap, perMap, subMap, fmt]);

  // === Transaction list (matching web TransactionListCard) ===
  const recentTx = useMemo(() => {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  }, [transactions]);
  const txTotalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const txTotalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  if (loading) return <Loading />;

  const CHART_COLORS = ["#0d9488", "#2563eb", "#7c3aed", "#ea8c00", "#dc2626", "#c026d3", "#16a34a", "#ea580c"];

  // Type toggle component
  const TypeToggle = ({ value, onChange }: { value: TransactionViewType; onChange: (v: TransactionViewType) => void }) => (
    <View style={styles.typeToggle}>
      <TouchableOpacity style={[styles.toggleBtn, value === "expense" && styles.toggleBtnActive]} onPress={() => onChange("expense")}>
        <Text style={[styles.toggleText, value === "expense" && styles.toggleTextActive]}>Gastos</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.toggleBtn, value === "income" && styles.toggleBtnActive]} onPress={() => onChange("income")}>
        <Text style={[styles.toggleText, value === "income" && styles.toggleTextActive]}>Receitas</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={[typography.h2, { color: colors.text }]}>{dashboardBlueprint.header.title}</Text>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 4 }]}>
        {dashboardBlueprint.header.subtitle}
      </Text>

      <GlobalFiltersBar />

      {/* Active selection banner */}
      {chartSelection.type && chartSelection.ids.length > 0 && (
        <Card style={styles.activeSelectionCard}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 8 }]}>
            Filtros ativos ({selectionLabel[chartSelection.type]}):
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
            {chartSelection.ids.map((id, index) => (
              <TouchableOpacity key={id} style={styles.filterPill} onPress={() => removeChartSelection(id)}>
                <Text style={styles.filterPillText}>{chartSelection.labels[index]} ✕</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.filterPill, styles.clearPill]} onPress={clearChartSelection}>
              <Text style={styles.clearPillText}>Limpar tudo</Text>
            </TouchableOpacity>
          </ScrollView>
        </Card>
      )}

      {/* === KPI Cards (4 cards like web) === */}
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>📈 Total Receitas</Text>
          <Text style={[typography.kpiValue, { color: colors.income }]}>{fmt(kpi.income)}</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>📉 Total Gastos</Text>
          <Text style={[typography.kpiValue, { color: colors.expense }]}>{fmt(kpi.expense)}</Text>
          {kpi.variation !== 0 && (
            <Text style={[typography.caption, { color: kpi.variation > 0 ? colors.destructive : colors.success, marginTop: 2 }]}>
              {kpi.variation > 0 ? "↑" : "↓"} {Math.abs(kpi.variation).toFixed(1)}% vs mês anterior
            </Text>
          )}
        </Card>
      </View>
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>💰 Saldo</Text>
          <Text style={[typography.kpiValue, { color: kpi.balance >= 0 ? colors.success : colors.destructive }]}>
            {fmt(kpi.balance)}
          </Text>
        </Card>
        <Card style={styles.kpiCard}>
          <TouchableOpacity onPress={cycleAvgMode}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              📊 Média {avgLabels[avgMode]} ▸
            </Text>
          </TouchableOpacity>
          <Text style={[typography.kpiValue, { color: avgValue >= 0 ? colors.success : colors.destructive }]}>
            {fmt(avgValue)}
          </Text>
        </Card>
      </View>

      {/* === Evolução Temporal (SpendingTimelineChart) === */}
      {monthlyTimeline.length > 0 && (
        <Card style={styles.section}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>📈 Evolução Temporal</Text>
          {monthlyTimeline.map(m => (
            <View key={m.month} style={styles.timelineRow}>
              <Text style={[typography.caption, { color: colors.textMuted, width: 50 }]}>{m.label}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(m.income / maxTimeline) * 100}%`, backgroundColor: colors.income }]} />
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(m.expense / maxTimeline) * 100}%`, backgroundColor: colors.expense }]} />
                </View>
              </View>
              <View style={{ width: 70, alignItems: "flex-end" }}>
                <Text style={[typography.caption, { color: colors.income }]}>{fmt(m.income)}</Text>
                <Text style={[typography.caption, { color: colors.expense }]}>{fmt(m.expense)}</Text>
              </View>
            </View>
          ))}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.income }]} /><Text style={styles.legendText}>Receita</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.expense }]} /><Text style={styles.legendText}>Despesa</Text></View>
          </View>
        </Card>
      )}

      {/* === Category Chart (CategoryChart - pie-like with %) === */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>
            {catViewType === "expense" ? "Gastos" : "Receitas"} por Categoria
          </Text>
          <TypeToggle value={catViewType} onChange={setCatViewType} />
        </View>
        {categoryData.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: "center", paddingVertical: 20 }]}>Sem dados</Text>
        ) : (
          categoryData.slice(0, 8).map((c, i) => {
            const pct = catTotal > 0 ? ((c.value / catTotal) * 100).toFixed(1) : "0";
            const isSelected = chartSelection.type === "category" && chartSelection.ids.includes(c.id);
            const isDimmed = chartSelection.type === "category" && chartSelection.ids.length > 0 && !isSelected;
            return (
              <TouchableOpacity key={c.id} style={[styles.catRow, isSelected && styles.catRowSelected, isDimmed && { opacity: 0.4 }]}
                onPress={() => toggleChartSelection("category", c.id, c.name)}>
                <View style={[styles.colorDot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.text, fontWeight: "600" }]}>{fmt(c.value)}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, width: 40, textAlign: "right" }]}>{pct}%</Text>
              </TouchableOpacity>
            );
          })
        )}
      </Card>

      {/* === Category Ranking (CategoryRankingChart) === */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>🏆 Ranking de {rankViewType === "expense" ? "Gastos" : "Receitas"}</Text>
          <TypeToggle value={rankViewType} onChange={setRankViewType} />
        </View>
        {rankingData.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: "center", paddingVertical: 20 }]}>Sem dados</Text>
        ) : (
          rankingData.map((c, i) => (
            <TouchableOpacity key={c.id} style={styles.barRow} onPress={() => toggleChartSelection("category", c.id, c.name)}>
              <Text style={[typography.bodySmall, { color: colors.text, width: 90 }]} numberOfLines={1}>{c.name}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(c.total / maxRanking) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, width: 75, textAlign: "right" }]}>{fmt(c.total)}</Text>
            </TouchableOpacity>
          ))
        )}
      </Card>

      {/* === Subcategory Chart (SubcategoryChart) === */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>{subViewType === "expense" ? "Gastos" : "Receitas"} por Subcategoria</Text>
          <TypeToggle value={subViewType} onChange={setSubViewType} />
        </View>
        {subcategoryData.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: "center", paddingVertical: 20 }]}>Sem dados</Text>
        ) : (
          subcategoryData.slice(0, 10).map((s, i) => {
            const pct = subTotal > 0 ? ((s.value / subTotal) * 100).toFixed(1) : "0";
            return (
              <TouchableOpacity key={s.id} style={styles.barRow} onPress={() => toggleChartSelection("subcategory", s.id, s.name)}>
                <View style={{ width: 90 }}>
                  <Text style={[typography.bodySmall, { color: colors.text }]} numberOfLines={1}>{s.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{s.catName}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(s.value / maxSub) * 100}%`, backgroundColor: "#f59e0b" }]} />
                </View>
                <View style={{ width: 75, alignItems: "flex-end" }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{fmt(s.value)}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, fontSize: 9 }]}>{pct}% • {s.count}x</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </Card>

      {/* === Persons Chart (PersonChart) === */}
      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>👤 Gastos por Pessoa</Text>
        {topPersons.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: "center", paddingVertical: 20 }]}>Sem dados</Text>
        ) : (
          topPersons.map((p, i) => (
            <TouchableOpacity key={p.id} style={styles.barRow} onPress={() => toggleChartSelection("person", p.id, p.name)}>
              <Text style={[typography.bodySmall, { color: colors.text, width: 90 }]} numberOfLines={1}>{p.name}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(p.expenses / maxPer) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, width: 75, textAlign: "right" }]}>{fmt(p.expenses)}</Text>
            </TouchableOpacity>
          ))
        )}
      </Card>

      {/* === Person Timeline (PersonTimelineChart) === */}
      {personTimeline.length > 0 && (
        <Card style={styles.section}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>👥 Evolução de Gastos por Pessoa</Text>
          {personTimeline.map(row => (
            <View key={row.month} style={styles.personTimelineRow}>
              <Text style={[typography.caption, { color: colors.textMuted, width: 50 }]}>
                {format(parseISO(`${row.month}-01`), "MMM yy", { locale: ptBR })}
              </Text>
              <View style={{ flex: 1, gap: 4 }}>
                {topPersons.slice(0, 3).map((person, pi) => (
                  <View key={person.id} style={styles.barRowCompact}>
                    <Text style={[typography.caption, { color: colors.textMuted, width: 44 }]} numberOfLines={1}>{person.name}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, {
                        width: `${person.expenses > 0 ? ((row.values[person.id] || 0) / person.expenses) * 100 : 0}%`,
                        backgroundColor: CHART_COLORS[pi % CHART_COLORS.length],
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* === Dynamic Dimension Charts (DimensionChart) === */}
      {dimensionCharts.map(dimension => {
        const max = Math.max(...dimension.items.map(i => i.value), 1);
        return (
          <Card key={dimension.key} style={styles.section}>
            <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>📌 {dimension.title}</Text>
            {dimension.items.length === 0 ? (
              <Text style={[typography.body, { color: colors.textMuted }]}>Sem dados</Text>
            ) : (
              dimension.items.map((item, i) => {
                const pct = dimension.total > 0 ? ((item.value / dimension.total) * 100).toFixed(1) : "0";
                return (
                  <TouchableOpacity key={item.id} style={styles.catRow} onPress={() => toggleChartSelection(dimension.key, item.id, item.name)}>
                    <View style={[styles.colorDot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                    <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[typography.bodySmall, { color: colors.text, fontWeight: "600" }]}>{fmt(item.value)}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, width: 40, textAlign: "right" }]}>{pct}%</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </Card>
        );
      })}

      {/* === Cumulative Balance (CumulativeBalanceChart) === */}
      {cumulativeBalance.length > 0 && (
        <Card style={styles.section}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>💰 Saldo Acumulado</Text>
          {cumulativeBalance.map(b => (
            <View key={b.month} style={styles.barRow}>
              <Text style={[typography.caption, { color: colors.textMuted, width: 50 }]}>{b.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                  width: `${(Math.abs(b.balance) / maxBalance) * 100}%`,
                  backgroundColor: b.balance >= 0 ? colors.success : colors.destructive,
                }]} />
              </View>
              <Text style={[typography.caption, { color: b.balance >= 0 ? colors.success : colors.destructive, width: 75, textAlign: "right", fontWeight: "600" }]}>
                {fmt(b.balance)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* === Weekday Chart (WeekdayChart - average per weekday) === */}
      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>📅 Média por Dia da Semana</Text>
        <View style={styles.weekdayRow}>
          {weekdaySpending.map(w => (
            <View key={w.name} style={styles.weekdayCol}>
              <View style={styles.weekdayBarTrack}>
                <View style={[styles.weekdayBarFill, { height: `${maxWeekday > 0 ? (w.avg / maxWeekday) * 100 : 0}%` }]} />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{w.name}</Text>
              <Text style={[typography.caption, { color: colors.text, fontSize: 8 }]}>{fmt(w.avg)}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* === Insights Panel (InsightsPanel) === */}
      <Card style={styles.section}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>💡 Insights Automáticos</Text>
        {insights.map((ins, i) => (
          <View key={i} style={styles.insightRow}>
            <Text style={[typography.body, { color: colors.text, lineHeight: 20 }]}>{ins}</Text>
          </View>
        ))}
      </Card>

      {/* === Transactions List (TransactionListCard) === */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>📋 Transações ({transactions.length})</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={[typography.caption, { color: colors.income }]}>+{fmt(txTotalIncome)}</Text>
            <Text style={[typography.caption, { color: colors.expense }]}>-{fmt(txTotalExpense)}</Text>
          </View>
        </View>
        {recentTx.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: "center", paddingVertical: 20 }]}>Nenhuma transação encontrada</Text>
        ) : (
          recentTx.map(t => (
            <View key={t.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: t.type === "income" ? `${colors.income}15` : `${colors.expense}15` }]}>
                <Text style={{ fontSize: 10 }}>{t.type === "income" ? "↗️" : "↙️"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[typography.bodySmall, { color: colors.text, fontWeight: "500" }]} numberOfLines={1}>
                    {catMap.get(t.category_id) || "?"}
                  </Text>
                  {subMap.get(t.subcategory_id) && (
                    <Text style={[typography.caption, { color: colors.textMuted }]}>/ {subMap.get(t.subcategory_id)}</Text>
                  )}
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {perMap.get(t.person_id) || "?"} · {format(parseISO(t.date), "dd MMM", { locale: ptBR })}
                </Text>
              </View>
              <Text style={[typography.bodySmall, { fontWeight: "600", color: t.type === "income" ? colors.income : colors.expense }]}>
                {t.type === "income" ? "+" : "-"}{t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpiCard: { flex: 1 },
  section: { marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  activeSelectionCard: { marginBottom: 12, marginTop: 4 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  barRowCompact: { flexDirection: "row", alignItems: "center", gap: 6 },
  catRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, gap: 8, borderRadius: 8 },
  catRowSelected: { backgroundColor: `${colors.primary}15` },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: `${colors.border}60`, gap: 8 },
  txIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  personTimelineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 8 },
  timelineRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.textMuted },
  insightRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${colors.border}60` },
  filterPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: `${colors.primary}18`, borderWidth: 1, borderColor: `${colors.primary}30`, marginRight: 6 },
  filterPillText: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  clearPill: { backgroundColor: `${colors.destructive}15`, borderColor: `${colors.destructive}35` },
  clearPillText: { fontSize: 11, color: colors.destructive, fontWeight: "600" },
  weekdayRow: { flexDirection: "row", justifyContent: "space-between", height: 120, alignItems: "flex-end" },
  weekdayCol: { alignItems: "center", flex: 1 },
  weekdayBarTrack: { width: 20, height: 80, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  weekdayBarFill: { width: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  typeToggle: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 6, overflow: "hidden" },
  toggleBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${colors.border}40` },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 10, fontWeight: "600", color: colors.textSecondary },
  toggleTextActive: { color: "#fff" },
});
