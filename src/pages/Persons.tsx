import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = [
  "hsl(168,80%,36%)", "hsl(199,89%,48%)", "hsl(262,52%,47%)", "hsl(38,92%,50%)",
  "hsl(0,72%,51%)", "hsl(326,78%,45%)", "hsl(142,71%,45%)", "hsl(24,95%,53%)",
];

export default function Persons() {
  const { filteredTransactions, setFilters } = useFinance();
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const personData = useMemo(() => {
    const map: Record<string, { name: string; expenses: number; incomes: number; count: number; id: string }> = {};
    filteredTransactions.forEach(t => {
      if (!map[t.person_id]) map[t.person_id] = { name: t.person_name || "?", expenses: 0, incomes: 0, count: 0, id: t.person_id };
      if (t.type === "expense") map[t.person_id].expenses += t.amount;
      else map[t.person_id].incomes += t.amount;
      map[t.person_id].count++;
    });
    return Object.values(map).sort((a, b) => b.expenses - a.expenses);
  }, [filteredTransactions]);

  const timeByPerson = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const nameMap: Record<string, string> = {};
    filteredTransactions.filter(t => t.type === "expense").forEach(t => {
      const month = format(parseISO(t.date), "yyyy-MM");
      if (!map[t.person_id]) map[t.person_id] = {};
      map[t.person_id][month] = (map[t.person_id][month] || 0) + t.amount;
      nameMap[t.person_id] = t.person_name || "?";
    });
    const months = [...new Set(filteredTransactions.map(t => format(parseISO(t.date), "yyyy-MM")))].sort();
    const personIds = Object.keys(map);
    return { data: months.map(m => {
      const entry: any = { month: format(parseISO(m + "-01"), "MMM/yy", { locale: ptBR }) };
      personIds.forEach(id => { entry[nameMap[id]] = map[id]?.[m] || 0; });
      return entry;
    }), names: personIds.map(id => nameMap[id]) };
  }, [filteredTransactions]);

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Análise por Pessoa</h1>
        <p className="text-sm text-muted-foreground">Compare gastos e receitas entre pessoas</p>
      </div>
      <GlobalFilters />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Ranking de Gastos</CardTitle></CardHeader>
          <CardContent>
            {personData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={personData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="expenses" name="Gastos" radius={[0, 4, 4, 0]}
                      onClick={d => setFilters(prev => ({ ...prev, persons: [d.id] }))} className="cursor-pointer">
                      {personData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Resumo por Pessoa</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {personData.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => setFilters(prev => ({ ...prev, persons: [p.id] }))}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.count} lançamentos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-destructive">-{fmt(p.expenses)}</p>
                  <p className="text-[10px] text-primary">+{fmt(p.incomes)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução de Gastos por Pessoa</CardTitle></CardHeader>
        <CardContent>
          {timeByPerson.data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={timeByPerson.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  {timeByPerson.names.map((p, i) => (
                    <Line key={p} type="monotone" dataKey={p} name={p} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
