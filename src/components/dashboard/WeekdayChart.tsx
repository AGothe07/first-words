import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { parseISO, getDay } from "date-fns";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function WeekdayChart() {
  const { crossFilteredTransactions } = useFinance();
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const data = useMemo(() => {
    const days = Array(7).fill(0).map((_, i) => ({ day: WEEKDAYS[i], total: 0, count: 0 }));
    crossFilteredTransactions.filter(t => t.type === "expense").forEach(t => {
      const idx = getDay(parseISO(t.date));
      days[idx].total += t.amount;
      days[idx].count++;
    });
    return days.map(d => ({ ...d, avg: d.count > 0 ? Math.round((d.total / d.count) * 100) / 100 : 0 }));
  }, [crossFilteredTransactions]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">📅 Média por Dia da Semana</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="avg" name="Média" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
