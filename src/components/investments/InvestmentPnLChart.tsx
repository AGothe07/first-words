import { useInvestments } from "@/contexts/InvestmentsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { useMemo } from "react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentPnLChart() {
  const { filteredInvestments } = useInvestments();

  const data = useMemo(() => {
    return filteredInvestments
      .filter(inv => inv.total_sold > 0 || inv.total_dividends > 0)
      .map(inv => ({
        name: inv.name.length > 15 ? inv.name.slice(0, 15) + "…" : inv.name,
        fullName: inv.name,
        pnl: inv.realized_pnl,
        vendas: inv.total_sold,
        rendimentos: inv.total_dividends,
        compras: inv.total_invested,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filteredInvestments]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Lucro/Prejuízo por Ativo</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Registre vendas ou rendimentos para ver o P&L
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Lucro/Prejuízo por Ativo</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={{
          pnl: { label: "Lucro/Prejuízo", color: "hsl(var(--chart-1))" },
        }} className="h-[280px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <YAxis type="category" dataKey="name" width={100} className="text-xs" />
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
            <ReferenceLine x={0} stroke="hsl(var(--border))" />
            <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.pnl >= 0 ? "hsl(160, 60%, 45%)" : "hsl(0, 70%, 55%)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
