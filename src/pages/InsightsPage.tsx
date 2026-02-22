import { AppLayout } from "@/components/layout/AppLayout";
import { useFinance } from "@/contexts/FinanceContext";
import { useAssets } from "@/contexts/AssetsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Shield,
  Target, BarChart3, Activity, Calendar, FileText, Users, Filter,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, differenceInMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
};

// ─── Person Filter Component ──────────────────────────────────────
function PersonFilter({
  persons,
  selectedIds,
  onChange,
}: {
  persons: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const allSelected = selectedIds.length === 0;
  const label = allSelected
    ? "Todas as pessoas"
    : selectedIds.length === 1
      ? persons.find(p => p.id === selectedIds[0])?.name || "1 pessoa"
      : `${selectedIds.length} pessoas`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
          <Users className="h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1 max-h-60 overflow-y-auto">
          <button
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent text-left"
            onClick={() => onChange([])}
          >
            <Checkbox checked={allSelected} />
            <span className="font-medium">Todas as pessoas</span>
          </button>
          {persons.map(p => {
            const checked = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent text-left"
                onClick={() => {
                  if (checked) {
                    const next = selectedIds.filter(id => id !== p.id);
                    onChange(next);
                  } else {
                    onChange([...selectedIds, p.id]);
                  }
                }}
              >
                <Checkbox checked={checked} />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Period Filter ─────────────────────────────────────────────────
const PERIOD_PRESETS = [
  { label: "6 meses", value: "6m" },
  { label: "Este ano", value: "year" },
  { label: "Tudo", value: "all" },
  { label: "Personalizado", value: "custom" },
];

interface PeriodFilter {
  preset: string;
  dateRange: { from: string; to: string } | null;
}

function getInsightsPeriodRange(pf: PeriodFilter): { from: Date; to: Date } | null {
  const today = new Date();
  switch (pf.preset) {
    case "6m": return { from: subMonths(today, 6), to: today };
    case "year": return { from: startOfYear(today), to: today };
    case "all": return null;
    case "custom":
      if (pf.dateRange?.from && pf.dateRange?.to) {
        return { from: parseISO(pf.dateRange.from), to: parseISO(pf.dateRange.to) };
      }
      return null;
    default: return null;
  }
}

function PeriodFilterBar({ value, onChange }: { value: PeriodFilter; onChange: (v: PeriodFilter) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex gap-1">
        {PERIOD_PRESETS.map(p => (
          <Button
            key={p.value}
            variant={value.preset === p.value ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => onChange({ ...value, preset: p.value })}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-7 text-xs w-[130px]"
            value={value.dateRange?.from || ""}
            onChange={e => onChange({
              ...value,
              dateRange: { from: e.target.value, to: value.dateRange?.to || "" },
            })}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="h-7 text-xs w-[130px]"
            value={value.dateRange?.to || ""}
            onChange={e => onChange({
              ...value,
              dateRange: { from: value.dateRange?.from || "", to: e.target.value },
            })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Monthly data builder ──────────────────────────────────────────
interface MonthlyRow {
  month: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
  cumulativeBalance: number;
  patrimony: number;
  savingsRate: number;
}

function useMonthlyData(selectedPersonIds: string[], periodFilter: PeriodFilter): MonthlyRow[] {
  const { transactions } = useFinance();
  const { assets } = useAssets();

  return useMemo(() => {
    const periodRange = getInsightsPeriodRange(periodFilter);

    // Filter transactions by selected persons
    let filtered = selectedPersonIds.length > 0
      ? transactions.filter(t => selectedPersonIds.includes(t.person_id))
      : transactions;

    // Filter by period
    if (periodRange) {
      filtered = filtered.filter(t => {
        const d = parseISO(t.date);
        return d >= periodRange.from && d <= periodRange.to;
      });
    }

    // Combine transaction dates AND asset dates to determine the full timeline
    const txDates = filtered.map(t => t.date);
    const assetDates = assets.map(a => a.date);
    let allDates = [...txDates, ...assetDates].sort();

    // Apply period filter to asset dates too
    if (periodRange) {
      allDates = allDates.filter(d => {
        const pd = parseISO(d);
        return pd >= periodRange.from && pd <= periodRange.to;
      });
    }

    if (allDates.length === 0) return [];

    const minDate = startOfMonth(parseISO(allDates[0]));
    const maxDate = endOfMonth(parseISO(allDates[allDates.length - 1]));
    const months = differenceInMonths(maxDate, minDate) + 1;

    // Build carry-forward patrimony: for each month, use latest known value per category up to that month
    const sortedAssets = [...assets].sort((a, b) => a.date.localeCompare(b.date));

    const data: MonthlyRow[] = [];
    let cumBalance = 0;

    for (let i = 0; i < months; i++) {
      const mStart = startOfMonth(new Date(minDate.getFullYear(), minDate.getMonth() + i));
      const mEnd = endOfMonth(mStart);
      const mKey = format(mStart, "yyyy-MM");
      const mLabel = format(mStart, "MMM/yy", { locale: ptBR });

      const monthTx = filtered.filter(t => {
        const d = parseISO(t.date);
        return d >= mStart && d <= mEnd;
      });

      const income = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const balance = income - expense;
      cumBalance += balance;

      // Patrimony: carry-forward — take latest known value per category up to mEnd
      const categoryLatest: Record<string, number> = {};
      sortedAssets
        .filter(a => parseISO(a.date) <= mEnd)
        .forEach(a => { categoryLatest[a.category] = a.value; });
      const patrimony = Object.values(categoryLatest).reduce((s, v) => s + v, 0);

      const savingsRate = income > 0 ? (balance / income) * 100 : 0;

      data.push({ month: mKey, label: mLabel, income, expense, balance, cumulativeBalance: cumBalance, patrimony, savingsRate });
    }

    return data;
  }, [transactions, assets, selectedPersonIds, periodFilter]);
}

// ─── Insight Generator ─────────────────────────────────────────────
function useInsightAnalysis(monthlyData: MonthlyRow[], selectedPersonIds: string[]) {
  const { transactions, persons } = useFinance();

  return useMemo(() => {
    const insights: Array<{ icon: typeof Lightbulb; color: string; title: string; text: string }> = [];
    if (monthlyData.length < 2) return insights;

    const filtered = selectedPersonIds.length > 0
      ? transactions.filter(t => selectedPersonIds.includes(t.person_id))
      : transactions;

    const personLabel = selectedPersonIds.length === 1
      ? persons.find(p => p.id === selectedPersonIds[0])?.name || ""
      : "";

    const recent3 = monthlyData.slice(-3);
    const prev3 = monthlyData.slice(-6, -3);

    // 1. Savings rate trend
    const avgSavingsRecent = recent3.reduce((s, m) => s + m.savingsRate, 0) / recent3.length;
    if (avgSavingsRecent > 20) {
      insights.push({ icon: TrendingUp, color: "text-primary", title: "Poupança saudável", text: `${personLabel ? personLabel + ": n" : "N"}os últimos 3 meses, taxa de poupança média de ${avgSavingsRecent.toFixed(0)}% da receita. Excelente ritmo de acúmulo.` });
    } else if (avgSavingsRecent < 0) {
      insights.push({ icon: AlertTriangle, color: "text-destructive", title: "Alerta de consumo", text: `${personLabel ? personLabel + ": g" : "G"}astos superaram receitas nos últimos 3 meses (${avgSavingsRecent.toFixed(0)}%). Atenção ao fluxo de caixa.` });
    } else if (avgSavingsRecent < 10) {
      insights.push({ icon: Lightbulb, color: "text-warning", title: "Margem apertada", text: `Taxa de poupança média de ${avgSavingsRecent.toFixed(0)}% nos últimos 3 meses. Pouco espaço para imprevistos.` });
    }

    // 2. Patrimony vs cumulative balance — uses full filtered period
    const firstMonth = monthlyData[0];
    const lastMonth = monthlyData[monthlyData.length - 1];
    const periodLabel = `de ${firstMonth.label} a ${lastMonth.label}`;
    
    const patrimonyGrowth = lastMonth.patrimony - firstMonth.patrimony;
    const balanceGenerated = lastMonth.cumulativeBalance - firstMonth.cumulativeBalance;

    if (lastMonth.patrimony > 0 || firstMonth.patrimony > 0) {
      if (patrimonyGrowth > 0 && balanceGenerated > 0) {
        const ratio = patrimonyGrowth / balanceGenerated;
        if (ratio > 1.5) {
          insights.push({ icon: TrendingUp, color: "text-primary", title: "Patrimônio acelerado", text: `No período ${periodLabel}, patrimônio cresceu ${fmt(patrimonyGrowth)} contra ${fmt(balanceGenerated)} de saldo gerado. A valorização de ativos pode estar impulsionando o crescimento além do fluxo de caixa.` });
        } else if (ratio < 0.5) {
          insights.push({ icon: AlertTriangle, color: "text-warning", title: "Caixa sem alocação em ativos", text: `No período ${periodLabel}, saldo acumulado cresceu ${fmt(balanceGenerated)} mas patrimônio apenas ${fmt(patrimonyGrowth)}. Parte do caixa gerado pode não estar sendo alocada em investimentos ou ativos.` });
        } else {
          insights.push({ icon: Shield, color: "text-primary", title: "Equilíbrio caixa/patrimônio", text: `No período ${periodLabel}, saldo gerado (${fmt(balanceGenerated)}) e crescimento patrimonial (${fmt(patrimonyGrowth)}) estão proporcionais. Boa alocação de recursos.` });
        }
      } else if (patrimonyGrowth < 0 && balanceGenerated > 0) {
        insights.push({ icon: Activity, color: "text-warning", title: "Divergência caixa/patrimônio", text: `No período ${periodLabel}, saldo acumulado cresceu ${fmt(balanceGenerated)} mas patrimônio reduziu ${fmt(Math.abs(patrimonyGrowth))}. Possíveis causas: desvalorização de ativos, resgate de investimentos ou realocação de portfólio.` });
      } else if (patrimonyGrowth > 0 && balanceGenerated < 0) {
        insights.push({ icon: Lightbulb, color: "text-primary", title: "Patrimônio resiliente", text: `No período ${periodLabel}, mesmo com saldo negativo de ${fmt(balanceGenerated)}, patrimônio cresceu ${fmt(patrimonyGrowth)}. Valorização de ativos pode estar compensando o consumo do caixa.` });
      } else if (patrimonyGrowth < 0 && balanceGenerated < 0) {
        insights.push({ icon: TrendingDown, color: "text-destructive", title: "Retração financeira", text: `No período ${periodLabel}, saldo e patrimônio em queda simultânea. Saldo caiu ${fmt(Math.abs(balanceGenerated))} e patrimônio ${fmt(Math.abs(patrimonyGrowth))}. Pode indicar consumo de reservas sem reposição.` });
      }
    }

    // 3. Quarterly acceleration
    if (prev3.length === 3) {
      const balRecent = recent3.reduce((s, m) => s + m.balance, 0);
      const balPrev = prev3.reduce((s, m) => s + m.balance, 0);
      const accel = balPrev !== 0 ? ((balRecent - balPrev) / Math.abs(balPrev)) * 100 : 0;

      if (accel > 20) {
        insights.push({ icon: TrendingUp, color: "text-primary", title: "Aceleração financeira", text: `Saldo líquido do trimestre atual é ${accel.toFixed(0)}% superior ao anterior. Trajetória ascendente.` });
      } else if (accel < -20) {
        insights.push({ icon: TrendingDown, color: "text-destructive", title: "Desaceleração financeira", text: `Saldo líquido do trimestre atual caiu ${Math.abs(accel).toFixed(0)}% em relação ao anterior. Revisar gastos recentes.` });
      }
    }

    // 4. Expense volatility
    if (monthlyData.length >= 3) {
      const expValues = monthlyData.slice(-6).map(m => m.expense);
      const avgExp = expValues.reduce((s, v) => s + v, 0) / expValues.length;
      const variance = expValues.reduce((s, v) => s + Math.pow(v - avgExp, 2), 0) / expValues.length;
      const cv = avgExp > 0 ? (Math.sqrt(variance) / avgExp) * 100 : 0;

      if (cv < 15) {
        insights.push({ icon: Shield, color: "text-primary", title: "Alta estabilidade", text: `Coeficiente de variação dos gastos em ${cv.toFixed(0)}%. Gastos muito previsíveis e controlados.` });
      } else if (cv > 40) {
        insights.push({ icon: Activity, color: "text-warning", title: "Gastos voláteis", text: `Coeficiente de variação de ${cv.toFixed(0)}%. Gastos oscilam bastante entre meses. Considere identificar picos.` });
      }
    }

    // 5. Category growth detection
    const expenses = filtered.filter(t => t.type === "expense");
    const byCatRecent: Record<string, number> = {};
    const byCatPrev: Record<string, number> = {};
    const now = new Date();
    const threeMonthsAgo = subMonths(now, 3);
    const sixMonthsAgo2 = subMonths(now, 6);

    expenses.forEach(t => {
      const d = parseISO(t.date);
      const catName = t.category_name || "?";
      if (d >= threeMonthsAgo) byCatRecent[catName] = (byCatRecent[catName] || 0) + t.amount;
      else if (d >= sixMonthsAgo2 && d < threeMonthsAgo) byCatPrev[catName] = (byCatPrev[catName] || 0) + t.amount;
    });

    for (const cat of Object.keys(byCatRecent)) {
      if (byCatPrev[cat] && byCatPrev[cat] > 0) {
        const growth = ((byCatRecent[cat] - byCatPrev[cat]) / byCatPrev[cat]) * 100;
        if (growth > 30) {
          insights.push({ icon: AlertTriangle, color: "text-warning", title: `"${cat}" em alta`, text: `Gastos com "${cat}" subiram ${growth.toFixed(0)}% no último trimestre vs anterior. Crescimento silencioso detectado.` });
          break;
        }
      }
    }

    // 6. Income concentration
    const incomes = filtered.filter(t => t.type === "income");
    const bySource: Record<string, number> = {};
    incomes.forEach(t => { bySource[t.category_name || "?"] = (bySource[t.category_name || "?"] || 0) + t.amount; });
    const totalIncome = Object.values(bySource).reduce((s, v) => s + v, 0);
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
    if (topSource && totalIncome > 0) {
      const concentration = (topSource[1] / totalIncome) * 100;
      if (concentration > 80) {
        insights.push({ icon: AlertTriangle, color: "text-warning", title: "Renda concentrada", text: `${concentration.toFixed(0)}% da receita vem de "${topSource[0]}". Alta dependência de fonte única.` });
      }
    }

    // 7. Projection
    if (monthlyData.length >= 3) {
      const last6 = monthlyData.slice(-6);
      const avgMonthlyBalance = last6.reduce((s, m) => s + m.balance, 0) / last6.length;
      const currentPatrimony = lastMonth.patrimony;
      if (currentPatrimony > 0) {
        const proj6 = currentPatrimony + avgMonthlyBalance * 6;
        const proj12 = currentPatrimony + avgMonthlyBalance * 12;
        insights.push({ icon: Target, color: "text-primary", title: "Projeção patrimonial", text: `Mantendo o ritmo atual, patrimônio estimado em 6 meses: ${fmt(proj6)} | 12 meses: ${fmt(proj12)}.` });
      }
    }

    return insights;
  }, [monthlyData, transactions, selectedPersonIds, persons]);
}

// ─── Seasonal analysis ─────────────────────────────────────────────
function useSeasonalAnalysis(selectedPersonIds: string[]) {
  const { transactions } = useFinance();

  return useMemo(() => {
    const filtered = selectedPersonIds.length > 0
      ? transactions.filter(t => selectedPersonIds.includes(t.person_id))
      : transactions;

    const expenses = filtered.filter(t => t.type === "expense");
    const byMonth: Record<number, number[]> = {};

    expenses.forEach(t => {
      const m = parseISO(t.date).getMonth();
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(t.amount);
    });

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return monthNames.map((name, i) => ({
      month: name,
      avgExpense: byMonth[i] ? byMonth[i].reduce((s, v) => s + v, 0) / Math.max(1, new Set(expenses.filter(t => parseISO(t.date).getMonth() === i).map(t => parseISO(t.date).getFullYear())).size) : 0,
    }));
  }, [transactions, selectedPersonIds]);
}

// ─── Monthly Executive Report ──────────────────────────────────────
function MonthlyReport({ monthlyData }: { monthlyData: MonthlyRow[] }) {
  if (monthlyData.length === 0) return null;

  const current = monthlyData[monthlyData.length - 1];
  const previous = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;

  const balanceChange = previous ? current.balance - previous.balance : 0;
  const expenseChange = previous && previous.expense > 0 ? ((current.expense - previous.expense) / previous.expense) * 100 : 0;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Relatório do Mês — {current.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Receita</p>
            <p className="text-sm font-bold text-primary">{fmt(current.income)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesa</p>
            <p className="text-sm font-bold text-destructive">{fmt(current.expense)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo (fluxo de caixa)</p>
            <p className={`text-sm font-bold ${current.balance >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(current.balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Taxa de poupança</p>
            <p className={`text-sm font-bold ${current.savingsRate >= 0 ? "text-primary" : "text-destructive"}`}>{current.savingsRate.toFixed(0)}%</p>
          </div>
        </div>
        {previous && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              {balanceChange >= 0 ? "📈" : "📉"} Saldo {balanceChange >= 0 ? "melhorou" : "piorou"} {fmt(Math.abs(balanceChange))} em relação ao mês anterior.
            </p>
            <p>
              {expenseChange <= 0 ? "✅" : "⚠️"} Despesas {expenseChange <= 0 ? "reduziram" : "aumentaram"} {Math.abs(expenseChange).toFixed(0)}% vs mês anterior.
            </p>
            {current.patrimony > 0 && previous.patrimony > 0 && (
              <p>
                {current.patrimony >= previous.patrimony ? "🏦" : "📉"} Patrimônio {current.patrimony >= previous.patrimony ? "cresceu" : "reduziu"} {fmt(Math.abs(current.patrimony - previous.patrimony))} vs mês anterior.
                {current.patrimony < previous.patrimony && current.balance > 0 && " Possível desvalorização de ativos ou resgate de investimentos."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function InsightsPage() {
  const { persons } = useFinance();
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({ preset: "all", dateRange: null });

  const activePersons = useMemo(() => persons.filter(p => p.is_active), [persons]);

  const monthlyData = useMonthlyData(selectedPersonIds, periodFilter);
  const insights = useInsightAnalysis(monthlyData, selectedPersonIds);
  const seasonalData = useSeasonalAnalysis(selectedPersonIds);

  const hasData = monthlyData.length > 0;

  return (
    <AppLayout>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Insights Financeiros</h1>
          <p className="text-sm text-muted-foreground">Análises inteligentes de comportamento, tendências e projeções</p>
        </div>
        <PersonFilter
          persons={activePersons}
          selectedIds={selectedPersonIds}
          onChange={setSelectedPersonIds}
        />
      </div>

      <div className="mb-4 p-3 rounded-lg border bg-card">
        <PeriodFilterBar value={periodFilter} onChange={setPeriodFilter} />
      </div>

      {!hasData ? (
        <Card className="border-border shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Adicione lançamentos e registros de patrimônio para ver análises inteligentes.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Monthly Report */}
          <div className="mb-4">
            <MonthlyReport monthlyData={monthlyData} />
          </div>

          {/* Insights cards */}
          {insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {insights.map((ins, i) => (
                <Card key={i} className="border-border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <ins.icon className={`h-4 w-4 ${ins.color}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-0.5">{ins.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{ins.text}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Charts row 1: Cumulative balance + Patrimony */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Evolução do Saldo (Fluxo de Caixa)
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Receitas menos despesas acumuladas mês a mês</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Area type="monotone" dataKey="cumulativeBalance" name="Saldo Acumulado" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Evolução Patrimonial
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Ativos totais (investimentos, aplicações, bens)</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyData.filter(m => m.patrimony > 0)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Area type="monotone" dataKey="patrimony" name="Patrimônio" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Chart: Comparative balance vs patrimony */}
          <Card className="border-border shadow-sm mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Correlação: Saldo Acumulado vs Patrimônio
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Saldo = dinheiro em caixa. Patrimônio = ativos totais. Divergências indicam movimentações de investimento ou valorização/desvalorização.
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} className="fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="cumulativeBalance" name="Saldo Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="patrimony" name="Patrimônio" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Charts row 2: Savings rate + Seasonal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Taxa de Poupança Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="savingsRate" name="Taxa de Poupança" fill="hsl(var(--primary) / 0.6)" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="savingsRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Comportamento Sazonal (Média de Gastos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={seasonalData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="avgExpense" name="Média Gastos" fill="hsl(var(--destructive) / 0.5)" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Balance per month (income vs expense) */}
          <Card className="border-border shadow-sm mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Receitas vs Despesas Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} className="fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Receita" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Despesa" fill="hsl(var(--destructive) / 0.7)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="balance" name="Saldo" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}
