import { useAssets } from "@/contexts/AssetsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AssetTimelineChart() {
  const { filteredAssets } = useAssets();

  const data = useMemo(() => {
    if (filteredAssets.length === 0) return [];

    // Group by month, sum all categories
    const byMonth = new Map<string, number>();
    filteredAssets.forEach(a => {
      const month = a.date.slice(0, 7); // yyyy-MM
      byMonth.set(month, (byMonth.get(month) || 0) + a.value);
    });

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month,
        label: format(parseISO(month + "-01"), "MMM/yy", { locale: ptBR }),
        total,
      }));
  }, [filteredAssets]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Evolução do Patrimônio</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Sem dados para exibir
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Evolução do Patrimônio</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{ total: { label: "Patrimônio", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} className="text-muted-foreground" />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
