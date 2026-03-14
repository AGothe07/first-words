import { useInvestments } from "@/contexts/InvestmentsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo } from "react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentRankingChart() {
  const { filteredInvestments } = useInvestments();

  const data = useMemo(() => {
    return [...filteredInvestments]
      .sort((a, b) => b.total_invested - a.total_invested)
      .slice(0, 10)
      .map(inv => ({ name: inv.name.length > 15 ? inv.name.slice(0, 15) + "…" : inv.name, total: inv.total_invested }));
  }, [filteredInvestments]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Ranking de Investimentos</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Ranking de Investimentos</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={{ total: { label: "Total Investido", color: "hsl(var(--chart-3))" } }} className="h-[280px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <YAxis type="category" dataKey="name" width={100} className="text-xs" />
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
            <Bar dataKey="total" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
