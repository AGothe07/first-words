import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label as ReLabel } from "recharts";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

type Granularity = "day" | "week" | "month";

function getGroupKey(dateStr: string, granularity: Granularity): string {
  const d = parseISO(dateStr);
  switch (granularity) {
    case "day": return dateStr;
    case "week": return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "month": return format(startOfMonth(d), "yyyy-MM");
  }
}

function formatLabel(key: string, granularity: Granularity): string {
  switch (granularity) {
    case "day": return format(parseISO(key), "dd/MM", { locale: ptBR });
    case "week": return `Sem ${format(parseISO(key), "dd/MM", { locale: ptBR })}`;
    case "month": return format(parseISO(key + "-01"), "MMM/yy", { locale: ptBR });
  }
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1000) return `R$${(n / 1000).toFixed(1)}k`;
  return `R$${n.toFixed(0)}`;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground">{data.label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Receitas:</span>
        <span className="text-primary font-medium">{fmt(data.incomes)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Gastos:</span>
        <span className="text-destructive font-medium">{fmt(data.expenses)}</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-1">
        <span className="text-muted-foreground">Saldo:</span>
        <span className={`font-semibold ${data.balance >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(data.balance)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Lançamentos:</span>
        <span className="font-medium">{data.count}</span>
      </div>
    </div>
  );
}

function DataLabel(props: any) {
  const { x, y, value, index, dataLength } = props;
  if (dataLength > 12 && index % 2 !== 0) return null; // skip labels when too many points
  return (
    <text x={x} y={y - 10} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={9} fontWeight={500}>
      {fmtShort(value)}
    </text>
  );
}

export function SpendingTimelineChart() {
  const { crossFilteredTransactions } = useFinance();
  const [granularity, setGranularity] = useState<Granularity>("month");

  const data = useMemo(() => {
    const groups: Record<string, { expenses: number; incomes: number; count: number }> = {};

    crossFilteredTransactions.forEach(t => {
      const key = getGroupKey(t.date.slice(0, 10), granularity);
      if (!groups[key]) groups[key] = { expenses: 0, incomes: 0, count: 0 };
      if (t.type === "expense") groups[key].expenses += t.amount;
      else groups[key].incomes += t.amount;
      groups[key].count++;
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, vals]) => ({
        key,
        label: formatLabel(key, granularity),
        expenses: Math.round(vals.expenses * 100) / 100,
        incomes: Math.round(vals.incomes * 100) / 100,
        balance: Math.round((vals.incomes - vals.expenses) * 100) / 100,
        count: vals.count,
      }));
  }, [crossFilteredTransactions, granularity]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">📈 Evolução Temporal</CardTitle>
          <Select value={granularity} onValueChange={v => setGranularity(v as Granularity)}>
            <SelectTrigger className="h-7 text-[11px] w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="day">Diário</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtShort(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="incomes"
                  name="Receitas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 6 }}
                  label={<DataLabel dataLength={data.length} />}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Gastos"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(var(--destructive))" }}
                  activeDot={{ r: 6 }}
                  label={<DataLabel dataLength={data.length} />}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
