import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { Lightbulb, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface Insight {
  icon: typeof Lightbulb;
  color: string;
  text: string;
}

export function InsightsPanel() {
  const { crossFilteredTransactions } = useFinance();

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const expenses = crossFilteredTransactions.filter(t => t.type === "expense");
    const incomes = crossFilteredTransactions.filter(t => t.type === "income");
    const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
    const totalInc = incomes.reduce((s, t) => s + t.amount, 0);

    if (crossFilteredTransactions.length === 0) {
      result.push({ icon: Lightbulb, color: "text-primary", text: "Comece adicionando lançamentos para ver insights automáticos." });
      return result;
    }

    if (totalExp > totalInc && totalInc > 0) {
      result.push({
        icon: AlertTriangle, color: "text-destructive",
        text: `⚠️ Gastos (R$${totalExp.toFixed(0)}) superam receitas (R$${totalInc.toFixed(0)}) em R$${(totalExp - totalInc).toFixed(0)}.`,
      });
    } else if (totalInc > totalExp && totalInc > 0) {
      const pct = (((totalInc - totalExp) / totalInc) * 100).toFixed(0);
      result.push({ icon: TrendingUp, color: "text-primary", text: `✅ Você está economizando ${pct}% da receita neste período.` });
    }

    const byCat: Record<string, { name: string; total: number }> = {};
    expenses.forEach(t => {
      if (!byCat[t.category_id]) byCat[t.category_id] = { name: t.category_name || "?", total: 0 };
      byCat[t.category_id].total += t.amount;
    });
    const sorted = Object.values(byCat).sort((a, b) => b.total - a.total);
    if (sorted.length > 0) {
      const pct = totalExp > 0 ? ((sorted[0].total / totalExp) * 100).toFixed(0) : "0";
      result.push({ icon: Lightbulb, color: "text-primary", text: `📊 "${sorted[0].name}" é sua maior categoria de gastos, representando ${pct}% do total.` });
    }

    const byPerson: Record<string, { name: string; total: number }> = {};
    expenses.forEach(t => {
      if (!byPerson[t.person_id]) byPerson[t.person_id] = { name: t.person_name || "?", total: 0 };
      byPerson[t.person_id].total += t.amount;
    });
    const topPerson = Object.values(byPerson).sort((a, b) => b.total - a.total);
    if (topPerson.length > 1) {
      result.push({ icon: Lightbulb, color: "text-primary", text: `👤 "${topPerson[0].name}" é quem mais gastou: R$${topPerson[0].total.toFixed(0)} (${((topPerson[0].total / totalExp) * 100).toFixed(0)}% do total).` });
    }

    if (expenses.length > 0) {
      const biggest = expenses.reduce((max, t) => t.amount > max.amount ? t : max, expenses[0]);
      result.push({ icon: TrendingDown, color: "text-warning", text: `💸 Maior gasto individual: R$${biggest.amount.toFixed(2)} em "${biggest.subcategory_name || biggest.category_name}" (${biggest.person_name}).` });
    }

    return result;
  }, [crossFilteredTransactions]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">💡 Insights Automáticos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-2 text-xs leading-relaxed">
            <ins.icon className={`h-4 w-4 mt-0.5 shrink-0 ${ins.color}`} />
            <span>{ins.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
