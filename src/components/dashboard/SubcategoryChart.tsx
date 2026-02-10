import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from "recharts";

const COLORS = [
  "hsl(168,80%,36%)", "hsl(199,89%,48%)", "hsl(262,52%,47%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(326,78%,45%)", "hsl(142,71%,45%)", "hsl(24,95%,53%)",
  "hsl(210,70%,50%)", "hsl(280,60%,50%)", "hsl(60,70%,45%)", "hsl(190,80%,40%)",
];

export function SubcategoryChart() {
  const { crossFilteredTransactions, filteredTransactions, chartSelection, toggleChartSelection, subcategories, categories } = useFinance();

  const sourceTransactions = chartSelection.type === "subcategory" ? filteredTransactions : crossFilteredTransactions;

  // Build stable color map: subcategory inherits parent category color index
  const subcategoryColorMap = useMemo(() => {
    const catColorMap: Record<string, number> = {};
    const catOrder: string[] = [];
    filteredTransactions.filter(t => t.type === "expense").forEach(t => {
      if (!catColorMap.hasOwnProperty(t.category_id)) {
        catColorMap[t.category_id] = catOrder.length;
        catOrder.push(t.category_id);
      }
    });

    const map: Record<string, string> = {};
    subcategories.forEach(sub => {
      const catIdx = catColorMap[sub.category_id];
      if (catIdx !== undefined) {
        map[sub.id] = COLORS[catIdx % COLORS.length];
      }
    });
    return map;
  }, [filteredTransactions, subcategories]);

  // Filter by selected categories if category cross-filter is active
  const activeCategoryIds = chartSelection.type === "category" && chartSelection.ids.length > 0
    ? chartSelection.ids
    : null;

  const data = useMemo(() => {
    let expenses = sourceTransactions.filter(t => t.type === "expense" && t.subcategory_id);

    if (activeCategoryIds) {
      expenses = expenses.filter(t => activeCategoryIds.includes(t.category_id));
    }

    const groups: Record<string, { name: string; value: number; count: number; id: string; categoryName: string }> = {};
    expenses.forEach(t => {
      const subId = t.subcategory_id!;
      if (!groups[subId]) {
        groups[subId] = {
          name: t.subcategory_name || "?",
          value: 0,
          count: 0,
          id: subId,
          categoryName: t.category_name || "?",
        };
      }
      groups[subId].value += t.amount;
      groups[subId].count++;
    });

    return Object.values(groups).sort((a, b) => b.value - a.value);
  }, [sourceTransactions, activeCategoryIds]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const hasSelection = chartSelection.type === "subcategory" && chartSelection.ids.length > 0;

  const handleClick = (d: { id: string; name: string }) => {
    toggleChartSelection("subcategory", d.id, d.name);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
    return (
      <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
        <p className="font-semibold">{d.name}</p>
        <p className="text-muted-foreground">Categoria: {d.categoryName}</p>
        <p>Total: <span className="font-bold">{fmt(d.value)}</span></p>
        <p>Percentual: {pct}%</p>
        <p>Lançamentos: {d.count}</p>
      </div>
    );
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Gastos por Subcategoria</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(_, i) => handleClick(data[i])}
                >
                  {data.map((d, i) => (
                    <Cell
                      key={d.id}
                      fill={subcategoryColorMap[d.id] || COLORS[i % COLORS.length]}
                      opacity={hasSelection ? (chartSelection.ids.includes(d.id) ? 1 : 0.25) : 1}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v: number) => fmt(v)}
                    style={{ fontSize: 9, fill: "hsl(220,9%,46%)" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
