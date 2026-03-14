import { useInvestments } from "@/contexts/InvestmentsContext";
import { getInvestmentTypeLabel } from "@/types/investments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { useMemo } from "react";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
  "hsl(160, 60%, 45%)", "hsl(280, 60%, 55%)", "hsl(30, 80%, 55%)",
];

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentDistributionChart() {
  const { filteredInvestments } = useInvestments();

  const data = useMemo(() => {
    const byType = new Map<string, number>();
    filteredInvestments.forEach(inv => {
      const label = getInvestmentTypeLabel(inv.type);
      byType.set(label, (byType.get(label) || 0) + inv.total_invested);
    });
    return Array.from(byType.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredInvestments]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const config = Object.fromEntries(data.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }]));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Distribuição por Tipo</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Distribuição por Tipo</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value" nameKey="name">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-medium">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
