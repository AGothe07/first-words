import { useMemo } from "react";
import { useFinance, ChartSelectionType } from "@/contexts/FinanceContext";
import { useDimensions } from "@/contexts/DimensionsContext";
import { DimensionKey, DIMENSION_LABELS } from "@/types/dimensions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
];

interface Props {
  dimensionKey: DimensionKey;
}

// Map DimensionKey to ChartSelectionType
const dimToSelectionType: Record<string, ChartSelectionType> = {
  payment_method: "payment_method",
  account: "account",
  project: "project",
};

export function DimensionChart({ dimensionKey }: Props) {
  const { crossFilteredTransactions, filteredTransactions, chartSelection, toggleChartSelection } = useFinance();
  const { paymentMethods, accounts, projects } = useDimensions();

  const selectionType = dimToSelectionType[dimensionKey];
  const isThisChartSelected = chartSelection.type === selectionType;
  const hasSelection = isThisChartSelected && chartSelection.ids.length > 0;

  // Use filteredTransactions when this chart owns the selection (so all slices show)
  const sourceTransactions = isThisChartSelected ? filteredTransactions : crossFilteredTransactions;

  const data = useMemo(() => {
    const map = new Map<string, { name: string; value: number; id: string }>();

    let getNameById: (id: string | null | undefined) => string | null;
    let getIdFromTransaction: (t: any) => string | null | undefined;

    switch (dimensionKey) {
      case "payment_method":
        getNameById = (id) => paymentMethods.find(p => p.id === id)?.name || null;
        getIdFromTransaction = (t) => t.payment_method_id;
        break;
      case "account":
        getNameById = (id) => accounts.find(a => a.id === id)?.name || null;
        getIdFromTransaction = (t) => t.account_id;
        break;
      case "project":
        getNameById = (id) => projects.find(p => p.id === id)?.name || null;
        getIdFromTransaction = (t) => t.project_id;
        break;
      default:
        return [];
    }

    for (const t of sourceTransactions) {
      const id = getIdFromTransaction(t);
      if (!id) {
        const key = "__sem__";
        const existing = map.get(key) || { name: "Sem definição", value: 0, id: key };
        existing.value += t.amount;
        map.set(key, existing);
        continue;
      }
      const name = getNameById(id);
      if (!name) continue;
      const existing = map.get(id) || { name, value: 0, id };
      existing.value += t.amount;
      map.set(id, existing);
    }

    return Array.from(map.values())
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sourceTransactions, dimensionKey, paymentMethods, accounts, projects]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleClick = (d: { name: string; id: string }) => {
    if (!selectionType || d.id === "__sem__") return;
    toggleChartSelection(selectionType, d.id, d.name);
  };

  const getOpacity = (d: { id: string }) => {
    if (!hasSelection) return 1;
    return chartSelection.ids.includes(d.id) ? 1 : 0.25;
  };

  if (data.length === 0) return null;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{DIMENSION_LABELS[dimensionKey]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="w-48 h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  stroke="none"
                  onClick={(_, i) => handleClick(data[i])}
                  className="cursor-pointer"
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={getOpacity(d)} />
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
                <button key={d.id} onClick={() => handleClick(d)}
                  className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left ${isSelected ? "bg-muted ring-1 ring-primary" : ""} ${isDimmed ? "opacity-40" : ""}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
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
      </CardContent>
    </Card>
  );
}
