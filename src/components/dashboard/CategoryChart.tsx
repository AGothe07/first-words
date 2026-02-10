import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(168,80%,36%)", "hsl(199,89%,48%)", "hsl(262,52%,47%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(326,78%,45%)", "hsl(142,71%,45%)", "hsl(24,95%,53%)",
  "hsl(210,70%,50%)", "hsl(280,60%,50%)", "hsl(60,70%,45%)", "hsl(190,80%,40%)",
];

export function CategoryChart() {
  const { crossFilteredTransactions, filteredTransactions, drillCategory, setDrillCategory, categories, chartSelection, toggleChartSelection, clearChartSelection } = useFinance();

  // Use filteredTransactions (not cross-filtered) so this chart shows all categories,
  // dimming unselected ones rather than hiding them
  const sourceTransactions = chartSelection.type === "category" ? filteredTransactions : crossFilteredTransactions;

  // Build a stable color map based on ALL categories from filteredTransactions
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

  const data = useMemo(() => {
    const expenses = sourceTransactions.filter(t => t.type === "expense");

    if (drillCategory) {
      const subs: Record<string, number> = {};
      expenses.filter(t => t.category_id === drillCategory).forEach(t => {
        const name = t.subcategory_name || "Sem subcategoria";
        subs[name] = (subs[name] || 0) + t.amount;
      });
      return Object.entries(subs)
        .map(([name, value]) => ({ name, value, id: "" }))
        .sort((a, b) => b.value - a.value);
    }

    const macro: Record<string, { name: string; value: number; id: string }> = {};
    expenses.forEach(t => {
      const catName = t.category_name || "?";
      if (!macro[t.category_id]) macro[t.category_id] = { name: catName, value: 0, id: t.category_id };
      macro[t.category_id].value += t.amount;
    });
    return Object.values(macro).sort((a, b) => b.value - a.value);
  }, [sourceTransactions, drillCategory]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const drillCatName = drillCategory ? categories.find(c => c.id === drillCategory)?.name : null;

  const hasSelection = chartSelection.type === "category" && chartSelection.ids.length > 0;

  const handleClick = (d: { name: string; value: number; id: string }) => {
    if (drillCategory) return;
    if (!d.id) return;
    toggleChartSelection("category", d.id, d.name);
  };

  const getColor = (d: { id: string }, index: number) => {
    return d.id ? (categoryColorMap[d.id] || COLORS[index % COLORS.length]) : COLORS[index % COLORS.length];
  };

  const getOpacity = (d: { id: string }) => {
    if (!hasSelection) return 1;
    return chartSelection.ids.includes(d.id) ? 1 : 0.25;
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {drillCatName ? `📂 ${drillCatName}` : "Gastos por Categoria"}
          </CardTitle>
          {drillCategory && (
            <button onClick={() => setDrillCategory(null)} className="text-xs text-primary hover:underline">
              ← Voltar
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
        ) : (
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="w-48 h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none"
                    onClick={(_, i) => handleClick(data[i])}
                    className="cursor-pointer">
                    {data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={getColor(d, i)}
                        opacity={getOpacity(d)}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1 max-h-48 overflow-auto w-full">
              {data.map((d, i) => {
                const isSelected = hasSelection && chartSelection.ids.includes(d.id);
                const isDimmed = hasSelection && !isSelected;
                return (
                  <button key={d.name} onClick={() => handleClick(d)}
                    className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left ${isSelected ? "bg-muted ring-1 ring-primary" : ""} ${isDimmed ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(d, i) }} />
                      <span className="text-xs font-medium">{d.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold">{fmt(d.value)}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
