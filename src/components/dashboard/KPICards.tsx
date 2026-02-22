import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMemo, useState } from "react";
import { subMonths, parseISO, isWithinInterval, startOfMonth, endOfMonth, differenceInDays, subDays, startOfYear } from "date-fns";

type AvgMode = "daily" | "weekly" | "monthly";

const avgLabels: Record<AvgMode, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

const avgOrder: AvgMode[] = ["daily", "weekly", "monthly"];

export function KPICards() {
  const { crossFilteredTransactions, filters } = useFinance();
  const [avgMode, setAvgMode] = useState<AvgMode>("daily");

  const stats = useMemo(() => {
    const expenses = crossFilteredTransactions.filter(t => t.type === "expense");
    const incomes = crossFilteredTransactions.filter(t => t.type === "income");
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpense;

    const now = new Date();
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));
    const prevExpenses = expenses.filter(t => {
      try { return isWithinInterval(parseISO(t.date), { start: prevStart, end: prevEnd }); } catch { return false; }
    }).reduce((s, t) => s + t.amount, 0);

    let calendarDays = 1;
    const getPresetRange = (preset: string): { from: Date; to: Date } | null => {
      switch (preset) {
        case "7d": return { from: subDays(now, 7), to: now };
        case "30d": return { from: subDays(now, 30), to: now };
        case "month": return { from: startOfMonth(now), to: endOfMonth(now) };
        case "year": return { from: startOfYear(now), to: now };
        case "upto_month": return { from: new Date(2000, 0, 1), to: endOfMonth(now) };
        case "all": return null;
        default: return null;
      }
    };

    if (filters.preset === "custom" && filters.dateRange) {
      const from = parseISO(filters.dateRange.from);
      const to = parseISO(filters.dateRange.to);
      calendarDays = differenceInDays(to, from) + 1;
    } else if (filters.preset === "upto_month" || filters.preset === "all") {
      // For "upto_month" and "all", use actual transaction date range instead of arbitrary start
      if (crossFilteredTransactions.length > 0) {
        const dates = crossFilteredTransactions.map(t => t.date).sort();
        const from = parseISO(dates[0]);
        const to = parseISO(dates[dates.length - 1]);
        calendarDays = differenceInDays(to, from) + 1;
      }
    } else if (filters.preset !== "all") {
      const range = getPresetRange(filters.preset);
      if (range) {
        calendarDays = differenceInDays(range.to, range.from) + 1;
      }
    }

    if (calendarDays < 1) calendarDays = 1;

    const avgDaily = balance / calendarDays;
    const avgWeekly = balance / Math.max(calendarDays / 7, 1);
    const avgMonthly = balance / Math.max(calendarDays / 30, 1);
    const variation = prevExpenses > 0 ? ((totalExpense - prevExpenses) / prevExpenses) * 100 : 0;

    return { totalExpense, totalIncome, balance, avgDaily, avgWeekly, avgMonthly, variation };
  }, [crossFilteredTransactions, filters]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const avgValue = avgMode === "daily" ? stats.avgDaily : avgMode === "weekly" ? stats.avgWeekly : stats.avgMonthly;

  const cycleAvgMode = () => {
    setAvgMode(prev => avgOrder[(avgOrder.indexOf(prev) + 1) % avgOrder.length]);
  };

  const cards = [
    { label: "Total Receitas", value: fmt(stats.totalIncome), icon: TrendingUp, color: "text-primary", bg: "bg-secondary" },
    { label: "Total Gastos", value: fmt(stats.totalExpense), icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Saldo", value: fmt(stats.balance), icon: Wallet, color: stats.balance >= 0 ? "text-primary" : "text-destructive", bg: stats.balance >= 0 ? "bg-secondary" : "bg-destructive/10" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <Card key={c.label} className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <div className={`p-2 rounded-lg ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{c.value}</p>
            {c.label === "Total Gastos" && stats.variation !== 0 && (
              <div className="flex items-center gap-1 mt-1">
                {stats.variation > 0 ? <ArrowUpRight className="h-3 w-3 text-destructive" /> : <ArrowDownRight className="h-3 w-3 text-primary" />}
                <span className={`text-xs ${stats.variation > 0 ? "text-destructive" : "text-primary"}`}>
                  {Math.abs(stats.variation).toFixed(1)}% vs mês anterior
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Average card with mode toggle */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={cycleAvgMode}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5 group"
            >
              Média {avgLabels[avgMode]}
              <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60">
                ▸ {avgLabels[avgOrder[(avgOrder.indexOf(avgMode) + 1) % avgOrder.length]]}
              </span>
            </button>
            <div className={`p-2 rounded-lg ${avgValue >= 0 ? "bg-secondary" : "bg-destructive/10"}`}>
              <DollarSign className={`h-4 w-4 ${avgValue >= 0 ? "text-primary" : "text-destructive"}`} />
            </div>
          </div>
          <p className="text-xl font-bold tracking-tight">{fmt(avgValue)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
