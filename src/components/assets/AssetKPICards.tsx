import { useAssets } from "@/contexts/AssetsContext";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Landmark, Crown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMemo } from "react";
import { parseISO, format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export function AssetKPICards() {
  const { filteredAssets } = useAssets();

  const stats = useMemo(() => {
    if (filteredAssets.length === 0) {
      return { currentTotal: 0, growth: 0, growthPct: 0, topCategory: "—", lastMonthVar: 0, avgMonthlyGrowthPct: 0, avgMonthlyGrowthBRL: 0 };
    }

    // Group by date, get the most recent snapshot
    const byDate = new Map<string, number>();
    filteredAssets.forEach(a => {
      byDate.set(a.date, (byDate.get(a.date) || 0) + a.value);
    });
    const sortedDates = Array.from(byDate.keys()).sort();
    const latestDate = sortedDates[sortedDates.length - 1];
    const earliestDate = sortedDates[0];
    const currentTotal = byDate.get(latestDate) || 0;
    const earliestTotal = byDate.get(earliestDate) || 0;
    const growth = currentTotal - earliestTotal;
    const growthPct = earliestTotal > 0 ? (growth / earliestTotal) * 100 : 0;

    // Top category at latest date
    const latestAssets = filteredAssets.filter(a => a.date === latestDate);
    const byCat = new Map<string, number>();
    latestAssets.forEach(a => {
      byCat.set(a.category, (byCat.get(a.category) || 0) + a.value);
    });
    let topCategory = "—";
    let topValue = 0;
    byCat.forEach((v, k) => { if (v > topValue) { topValue = v; topCategory = k; } });

    // Last month variation
    const now = new Date();
    const prevMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
    const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
    const curMonthStart = format(startOfMonth(now), "yyyy-MM-dd");

    const prevMonthDates = sortedDates.filter(d => d >= prevMonthStart && d <= prevMonthEnd);
    const curMonthDates = sortedDates.filter(d => d >= curMonthStart);
    
    let lastMonthVar = 0;
    if (prevMonthDates.length > 0 && curMonthDates.length > 0) {
      const prevTotal = byDate.get(prevMonthDates[prevMonthDates.length - 1]) || 0;
      const curTotal = byDate.get(curMonthDates[curMonthDates.length - 1]) || 0;
      lastMonthVar = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : 0;
    }

    // Average monthly growth (% and BRL)
    let avgMonthlyGrowthPct = 0;
    let avgMonthlyGrowthBRL = 0;
    if (sortedDates.length >= 2) {
      // Group totals by month (yyyy-MM)
      const byMonth = new Map<string, number>();
      sortedDates.forEach(d => {
        const month = d.substring(0, 7);
        // Use the latest date's total for each month
        byMonth.set(month, byDate.get(d) || 0);
      });
      const months = Array.from(byMonth.keys()).sort();
      if (months.length >= 2) {
        let sumPct = 0;
        let sumBRL = 0;
        let count = 0;
        for (let i = 1; i < months.length; i++) {
          const prev = byMonth.get(months[i - 1]) || 0;
          const cur = byMonth.get(months[i]) || 0;
          sumBRL += cur - prev;
          if (prev > 0) sumPct += ((cur - prev) / prev) * 100;
          count++;
        }
        if (count > 0) {
          avgMonthlyGrowthPct = sumPct / count;
          avgMonthlyGrowthBRL = sumBRL / count;
        }
      }
    }

    return { currentTotal, growth, growthPct, topCategory, lastMonthVar, avgMonthlyGrowthPct, avgMonthlyGrowthBRL };
  }, [filteredAssets]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const avgGrowthPositive = stats.avgMonthlyGrowthBRL >= 0;
  const AvgIcon = avgGrowthPositive ? TrendingUp : TrendingDown;

  const cards = [
    {
      label: "Patrimônio Atual",
      value: fmt(stats.currentTotal),
      icon: Landmark,
      color: "text-primary",
      bg: "bg-secondary",
    },
    {
      label: "Crescimento no Período",
      value: fmt(stats.growth),
      icon: stats.growth >= 0 ? TrendingUp : TrendingDown,
      color: stats.growth >= 0 ? "text-primary" : "text-destructive",
      bg: stats.growth >= 0 ? "bg-secondary" : "bg-destructive/10",
      sub: stats.growthPct !== 0 ? `${stats.growthPct >= 0 ? "+" : ""}${stats.growthPct.toFixed(1)}%` : null,
      subPositive: stats.growthPct >= 0,
    },
    {
      label: "Média Mensal",
      value: fmt(stats.avgMonthlyGrowthBRL),
      icon: AvgIcon,
      color: avgGrowthPositive ? "text-primary" : "text-destructive",
      bg: avgGrowthPositive ? "bg-secondary" : "bg-destructive/10",
      sub: `${stats.avgMonthlyGrowthPct >= 0 ? "+" : ""}${stats.avgMonthlyGrowthPct.toFixed(1)}% ao mês`,
      subPositive: stats.avgMonthlyGrowthPct >= 0,
    },
    {
      label: "Maior Categoria",
      value: stats.topCategory,
      icon: Crown,
      color: "text-primary",
      bg: "bg-secondary",
      isText: true,
    },
    {
      label: "Var. Último Mês",
      value: stats.lastMonthVar !== 0 ? `${stats.lastMonthVar >= 0 ? "+" : ""}${stats.lastMonthVar.toFixed(1)}%` : "—",
      icon: stats.lastMonthVar >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.lastMonthVar >= 0 ? "text-primary" : "text-destructive",
      bg: stats.lastMonthVar >= 0 ? "bg-secondary" : "bg-destructive/10",
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map(c => (
        <Card key={c.label} className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <div className={`p-2 rounded-lg ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
            </div>
            <p className={`font-bold tracking-tight ${c.isText ? "text-base" : "text-xl"}`}>{c.value}</p>
            {"sub" in c && c.sub && (
              <div className="flex items-center gap-1 mt-1">
                {c.subPositive ? <ArrowUpRight className="h-3 w-3 text-primary" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
                <span className={`text-xs ${c.subPositive ? "text-primary" : "text-destructive"}`}>{c.sub}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
