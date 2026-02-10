import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const COLORS = [
  "hsl(168,80%,36%)", "hsl(199,89%,48%)", "hsl(262,52%,47%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(326,78%,45%)", "hsl(142,71%,45%)", "hsl(24,95%,53%)",
  "hsl(210,70%,50%)", "hsl(280,60%,50%)",
];

export function CategoryRankingChart() {
  const { crossFilteredTransactions, filteredTransactions, chartSelection, toggleChartSelection } = useFinance();

  // Stable color map from all filtered data
  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const seen = new Set<string>();
    filteredTransactions.filter(t => t.type === "expense").forEach(t => {
      if (!seen.has(t.category_id)) {
        map[t.category_id] = COLORS[seen.size % COLORS.length];
        seen.add(t.category_id);
      }
    });
    return map;
  }, [filteredTransactions]);

  const sourceTransactions = chartSelection.type === "category" ? filteredTransactions : crossFilteredTransactions;

  const data = useMemo(() => {
    const byCat: Record<string, { name: string; total: number; id: string }> = {};
    sourceTransactions.filter(t => t.type === "expense").forEach(t => {
      const name = t.category_name || "?";
      if (!byCat[t.category_id]) byCat[t.category_id] = { name, total: 0, id: t.category_id };
      byCat[t.category_id].total += t.amount;
    });
    return Object.values(byCat).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [sourceTransactions]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hasSelection = chartSelection.type === "category" && chartSelection.ids.length > 0;

  const handleClick = (d: any) => {
    toggleChartSelection("category", d.id, d.name);
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">🏆 Ranking de Categorias</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}
                  onClick={(d) => handleClick(d)}
                  className="cursor-pointer">
                  {data.map((d) => (
                    <Cell
                      key={d.id}
                      fill={categoryColorMap[d.id] || COLORS[0]}
                      opacity={hasSelection && !chartSelection.ids.includes(d.id) ? 0.25 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
