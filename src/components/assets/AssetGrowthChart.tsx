import { useAssets } from "@/contexts/AssetsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AssetGrowthChart() {
  const { filteredAssets } = useAssets();

  const data = useMemo(() => {
    if (filteredAssets.length === 0) return [];

    const byMonth = new Map<string, number>();
    filteredAssets.forEach(a => {
      const month = a.date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + a.value);
    });

    const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));

    return sorted.map(([month, total], i) => {
      const prev = i > 0 ? sorted[i - 1][1] : total;
      const growth = total - prev;
      const pct = prev > 0 ? (growth / prev) * 100 : 0;
      return {
        month,
        label: format(parseISO(month + "-01"), "MMM/yy", { locale: ptBR }),
        growth,
        pct,
      };
    });
  }, [filteredAssets]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (data.length <= 1) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Crescimento Mensal</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Dados insuficientes (mínimo 2 meses)
        </CardContent>
      </Card>
    );
  }

  // Skip the first month (no comparison)
  const chartData = data.slice(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Crescimento Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{ growth: { label: "Crescimento", color: "hsl(var(--chart-7))" } }} className="h-[250px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <ChartTooltip
              content={<ChartTooltipContent
                formatter={(value, name, item) => (
                  <span>{fmt(Number(value))} ({item.payload.pct >= 0 ? "+" : ""}{item.payload.pct.toFixed(1)}%)</span>
                )}
              />}
            />
            <Bar
              dataKey="growth"
              radius={[4, 4, 0, 0]}
              fill="hsl(var(--chart-7))"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
