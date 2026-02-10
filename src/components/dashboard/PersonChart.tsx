import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const COLORS = [
  "hsl(168,80%,36%)", "hsl(199,89%,48%)", "hsl(262,52%,47%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(326,78%,45%)", "hsl(142,71%,45%)", "hsl(24,95%,53%)",
];

export function PersonChart() {
  const { crossFilteredTransactions, filteredTransactions, chartSelection, toggleChartSelection } = useFinance();

  // Stable color map for persons
  const personColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const seen = new Set<string>();
    filteredTransactions.forEach(t => {
      if (!seen.has(t.person_id)) {
        map[t.person_id] = COLORS[seen.size % COLORS.length];
        seen.add(t.person_id);
      }
    });
    return map;
  }, [filteredTransactions]);

  const sourceTransactions = chartSelection.type === "person" ? filteredTransactions : crossFilteredTransactions;

  const data = useMemo(() => {
    const byPerson: Record<string, { name: string; expenses: number; incomes: number; id: string }> = {};
    sourceTransactions.forEach(t => {
      if (!byPerson[t.person_id]) byPerson[t.person_id] = { name: t.person_name || "?", expenses: 0, incomes: 0, id: t.person_id };
      if (t.type === "expense") byPerson[t.person_id].expenses += t.amount;
      else byPerson[t.person_id].incomes += t.amount;
    });
    return Object.values(byPerson).sort((a, b) => b.expenses - a.expenses);
  }, [sourceTransactions]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hasSelection = chartSelection.type === "person" && chartSelection.ids.length > 0;

  const handleClick = (d: any) => {
    toggleChartSelection("person", d.id, d.name);
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">👤 Gastos por Pessoa</CardTitle>
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
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="expenses" name="Gastos" radius={[0, 4, 4, 0]}
                  onClick={(d) => handleClick(d)}
                  className="cursor-pointer">
                  {data.map((d) => (
                    <Cell
                      key={d.id}
                      fill={personColorMap[d.id] || COLORS[0]}
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
