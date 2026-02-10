import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import { format, parseISO, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Timeline() {
  const { filteredTransactions } = useFinance();
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const timeData = useMemo(() => {
    const group: Record<string, { expenses: number; incomes: number }> = {};
    filteredTransactions.forEach(t => {
      let key: string;
      const d = parseISO(t.date);
      if (granularity === "day") key = t.date.slice(0, 10);
      else if (granularity === "week") {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = format(weekStart, "yyyy-MM-dd");
      } else key = format(d, "yyyy-MM");

      if (!group[key]) group[key] = { expenses: 0, incomes: 0 };
      if (t.type === "expense") group[key].expenses += t.amount;
      else group[key].incomes += t.amount;
    });

    return Object.entries(group).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      date: k,
      label: granularity === "month" ? format(parseISO(k + "-01"), "MMM/yy", { locale: ptBR }) : format(parseISO(k), "dd/MM", { locale: ptBR }),
      ...v,
    }));
  }, [filteredTransactions, granularity]);

  const weekdayData = useMemo(() => {
    const days = Array(7).fill(0).map((_, i) => ({ day: WEEKDAYS[i], total: 0, count: 0 }));
    filteredTransactions.filter(t => t.type === "expense").forEach(t => {
      const idx = getDay(parseISO(t.date));
      days[idx].total += t.amount;
      days[idx].count++;
    });
    return days.map(d => ({ ...d, avg: d.count > 0 ? d.total / d.count : 0 }));
  }, [filteredTransactions]);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Análise Temporal</h1>
          <p className="text-sm text-muted-foreground">Evolução de gastos e receitas ao longo do tempo</p>
        </div>
        <Select value={granularity} onValueChange={v => setGranularity(v as any)}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Diário</SelectItem>
            <SelectItem value="week">Semanal</SelectItem>
            <SelectItem value="month">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <GlobalFilters />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução por Período</CardTitle></CardHeader>
          <CardContent>
            {timeData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={timeData}>
                    <defs>
                      <linearGradient id="tIncGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(168,80%,36%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(168,80%,36%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="tExpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0,72%,51%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Area type="monotone" dataKey="incomes" name="Receitas" stroke="hsl(168,80%,36%)" fill="url(#tIncGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Gastos" stroke="hsl(0,72%,51%)" fill="url(#tExpGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Média por Dia da Semana</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={weekdayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="avg" name="Média" fill="hsl(168,80%,36%)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
