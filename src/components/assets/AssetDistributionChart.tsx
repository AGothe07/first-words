import { useAssets } from "@/contexts/AssetsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { useMemo } from "react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

export function AssetDistributionChart() {
  const { filteredAssets } = useAssets();

  const data = useMemo(() => {
    if (filteredAssets.length === 0) return [];

    // Get the most recent date
    const sortedDates = [...new Set(filteredAssets.map(a => a.date))].sort();
    const latestDate = sortedDates[sortedDates.length - 1];
    const latestAssets = filteredAssets.filter(a => a.date === latestDate);

    const byCat = new Map<string, number>();
    latestAssets.forEach(a => {
      byCat.set(a.category, (byCat.get(a.category) || 0) + a.value);
    });

    return Array.from(byCat.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAssets]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const total = data.reduce((s, d) => s + d.value, 0);

  const config = Object.fromEntries(data.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }]));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Distribuição por Categoria</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Sem dados para exibir
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Distribuição por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 justify-center">
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
