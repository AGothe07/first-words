import { useInvestments } from "@/contexts/InvestmentsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentTimelineChart() {
  const { entries, filteredInvestments } = useInvestments();

  const data = useMemo(() => {
    const validIds = new Set(filteredInvestments.map(i => i.id));
    const filtered = entries.filter(e => validIds.has(e.investment_id));
    if (filtered.length === 0) return [];

    const byMonth = new Map<string, number>();
    filtered.forEach(e => {
      const month = e.date.substring(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + e.amount);
    });

    const sorted = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    return sorted.map(([month, amount]) => {
      cumulative += amount;
      return {
        month,
        label: format(parseISO(month + "-01"), "MMM yy", { locale: ptBR }),
        aportes: amount,
        acumulado: cumulative,
      };
    });
  }, [entries, filteredInvestments]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Evolução dos Aportes</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Evolução dos Aportes</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={{
          acumulado: { label: "Acumulado", color: "hsl(var(--chart-1))" },
          aportes: { label: "Aporte Mensal", color: "hsl(var(--chart-2))" },
        }} className="h-[300px] w-full">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
            <Area type="monotone" dataKey="acumulado" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
