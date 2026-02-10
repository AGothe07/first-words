import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = [
  "hsl(168,80%,36%)", "hsl(199,89%,48%)", "hsl(262,52%,47%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(326,78%,45%)", "hsl(142,71%,45%)", "hsl(24,95%,53%)",
];

export function PersonTimelineChart() {
  const { crossFilteredTransactions } = useFinance();
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const { data, names } = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const nameMap: Record<string, string> = {};
    crossFilteredTransactions.filter(t => t.type === "expense").forEach(t => {
      const month = format(parseISO(t.date), "yyyy-MM");
      if (!map[t.person_id]) map[t.person_id] = {};
      map[t.person_id][month] = (map[t.person_id][month] || 0) + t.amount;
      nameMap[t.person_id] = t.person_name || "?";
    });
    const months = [...new Set(crossFilteredTransactions.map(t => format(parseISO(t.date), "yyyy-MM")))].sort();
    const personIds = Object.keys(map);
    return {
      data: months.map(m => {
        const entry: any = { month: format(parseISO(m + "-01"), "MMM/yy", { locale: ptBR }) };
        personIds.forEach(id => { entry[nameMap[id]] = Math.round((map[id]?.[m] || 0) * 100) / 100; });
        return entry;
      }),
      names: personIds.map(id => nameMap[id]),
    };
  }, [crossFilteredTransactions]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">👥 Evolução de Gastos por Pessoa</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                {names.map((p, i) => (
                  <Line key={p} type="monotone" dataKey={p} name={p} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
