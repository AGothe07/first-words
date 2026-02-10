import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold">{d.label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Saldo acumulado:</span>
        <span className={`font-semibold ${d.balance >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(d.balance)}</span>
      </div>
    </div>
  );
}

export function CumulativeBalanceChart() {
  const { crossFilteredTransactions } = useFinance();

  const data = useMemo(() => {
    // Aggregate by month for consistency
    const byMonth: Record<string, number> = {};
    crossFilteredTransactions.forEach(t => {
      const key = format(startOfMonth(parseISO(t.date)), "yyyy-MM");
      if (!byMonth[key]) byMonth[key] = 0;
      byMonth[key] += t.type === "income" ? t.amount : -t.amount;
    });

    const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    return sorted.map(([month, val]) => {
      cumulative += val;
      return {
        month,
        label: format(parseISO(month + "-01"), "MMM/yy", { locale: ptBR }),
        balance: Math.round(cumulative * 100) / 100,
      };
    });
  }, [crossFilteredTransactions]);

  // Determine if overall trend is positive or negative
  const lastBalance = data.length > 0 ? data[data.length - 1].balance : 0;
  const isPositive = lastBalance >= 0;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">💰 Saldo Acumulado</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="balGradPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142,71%,45%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="balGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0,72%,51%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Saldo"
                  stroke={isPositive ? "hsl(142,71%,45%)" : "hsl(0,72%,51%)"}
                  fill={isPositive ? "url(#balGradPos)" : "url(#balGradNeg)"}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: isPositive ? "hsl(142,71%,45%)" : "hsl(0,72%,51%)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
