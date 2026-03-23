import { useInvestments } from "@/contexts/InvestmentsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
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

    const byMonth = new Map<string, { buy: number; sell: number; dividend: number }>();
    filtered.forEach(e => {
      const month = e.date.substring(0, 7);
      const cur = byMonth.get(month) || { buy: 0, sell: 0, dividend: 0 };
      cur[e.entry_type] = (cur[e.entry_type] || 0) + e.amount;
      byMonth.set(month, cur);
    });

    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, vals]) => ({
        month,
        label: format(parseISO(month + "-01"), "MMM yy", { locale: ptBR }),
        compras: vals.buy,
        vendas: vals.sell,
        rendimentos: vals.dividend,
        resultado: vals.sell + vals.dividend - vals.buy,
      }));
  }, [entries, filteredInvestments]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Fluxo Mensal de Investimentos</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Fluxo Mensal de Investimentos</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={{
          compras: { label: "Compras", color: "hsl(var(--chart-1))" },
          vendas: { label: "Vendas", color: "hsl(var(--chart-2))" },
          rendimentos: { label: "Rendimentos", color: "hsl(var(--chart-3))" },
        }} className="h-[300px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="compras" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="vendas" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="rendimentos" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
