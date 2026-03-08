import { useState, useEffect, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useFinance } from "@/contexts/FinanceContext";
import { useAssets } from "@/contexts/AssetsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Heart, TrendingUp, PiggyBank, ShieldCheck, BarChart3, Info } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval, format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ScoreFactor {
  label: string;
  description: string;
  score: number; // 0-100
  weight: number;
  icon: React.ElementType;
  detail: string;
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Muito Bom";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Regular";
  if (score >= 20) return "Atenção";
  return "Crítico";
}

function getScoreBgColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-warning";
  return "bg-destructive";
}

export default function FinancialScorePage() {
  const { user } = useAuth();
  const { transactions } = useFinance();
  const { assets } = useAssets();
  const [budgets, setBudgets] = useState<any[]>([]);

  // Fetch budgets
  useEffect(() => {
    if (!user) return;
    supabase.from("budgets").select("*").eq("user_id", user.id).then(({ data }) => {
      setBudgets((data as any[]) || []);
    });
  }, [user]);

  const factors = useMemo<ScoreFactor[]>(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));
    const last3MonthStart = startOfMonth(subMonths(now, 2));

    // Current month income/expense
    let monthIncome = 0, monthExpense = 0;
    let prev3MonthIncome = 0, prev3MonthExpense = 0;
    let totalMonths = new Set<string>();

    transactions.forEach(t => {
      const d = parseISO(t.date);
      const monthKey = format(d, "yyyy-MM");
      totalMonths.add(monthKey);

      if (isWithinInterval(d, { start: monthStart, end: monthEnd })) {
        if (t.type === "income") monthIncome += Number(t.amount);
        else monthExpense += Number(t.amount);
      }
      if (isWithinInterval(d, { start: last3MonthStart, end: monthEnd })) {
        if (t.type === "income") prev3MonthIncome += Number(t.amount);
        else prev3MonthExpense += Number(t.amount);
      }
    });

    // 1. SAVINGS RATE (30 points)
    // Based on last 3 months average
    const avgIncome = prev3MonthIncome / 3;
    const avgExpense = prev3MonthExpense / 3;
    const savingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0;
    // Score: 20%+ savings = 100, 10% = 70, 0% = 40, negative = 0
    let savingsScore = 0;
    if (savingsRate >= 20) savingsScore = 100;
    else if (savingsRate >= 10) savingsScore = 70 + (savingsRate - 10) * 3;
    else if (savingsRate >= 0) savingsScore = 40 + savingsRate * 3;
    else savingsScore = Math.max(0, 40 + savingsRate * 2);

    // 2. BUDGET ADHERENCE (25 points)
    let budgetScore = 50; // default if no budgets
    let budgetDetail = "Sem orçamento definido";
    if (budgets.length > 0) {
      let withinBudget = 0;
      budgets.forEach(b => {
        const spent = transactions
          .filter(t => t.type === "expense" && t.category_id === b.category_id && isWithinInterval(parseISO(t.date), { start: monthStart, end: monthEnd }))
          .reduce((s, t) => s + Number(t.amount), 0);
        const pct = Number(b.amount) > 0 ? spent / Number(b.amount) : 0;
        if (pct <= 1) withinBudget++;
      });
      const adherencePct = (withinBudget / budgets.length) * 100;
      budgetScore = adherencePct;
      budgetDetail = `${withinBudget}/${budgets.length} categorias dentro do limite`;
    }

    // 3. ASSET GROWTH (25 points)
    let assetScore = 30; // default if no assets
    let assetDetail = "Sem patrimônio registrado";
    if (assets.length > 0) {
      // Compare latest total vs 3 months ago
      const latestByCategory = new Map<string, number>();
      const olderByCategory = new Map<string, number>();

      assets.forEach(a => {
        const d = parseISO(a.date);
        const key = a.category;
        // Latest value per category
        if (!latestByCategory.has(key) || a.date > (assets.find(x => x.category === key && latestByCategory.get(key) === Number(x.value))?.date || "")) {
          latestByCategory.set(key, Number(a.value));
        }
      });

      const totalLatest = Array.from(latestByCategory.values()).reduce((s, v) => s + v, 0);

      if (totalLatest > 0) {
        assetScore = Math.min(100, 60 + Math.min(40, totalLatest / 10000)); // Base 60 for having assets
        assetDetail = `Patrimônio total: R$ ${totalLatest.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      }
    }

    // 4. CONSISTENCY (20 points)
    // How many of the last 3 months have transactions
    const last3 = [
      format(now, "yyyy-MM"),
      format(subMonths(now, 1), "yyyy-MM"),
      format(subMonths(now, 2), "yyyy-MM"),
    ];
    const activeMonths = last3.filter(m => totalMonths.has(m)).length;
    const consistencyScore = activeMonths === 3 ? 100 : activeMonths === 2 ? 70 : activeMonths === 1 ? 40 : 10;

    return [
      {
        label: "Taxa de Poupança",
        description: "Percentual da renda que você poupa",
        score: Math.round(savingsScore),
        weight: 30,
        icon: PiggyBank,
        detail: avgIncome > 0 ? `${savingsRate.toFixed(1)}% da renda (média 3 meses)` : "Sem receitas registradas",
      },
      {
        label: "Controle de Gastos",
        description: "Aderência ao orçamento mensal",
        score: Math.round(budgetScore),
        weight: 25,
        icon: ShieldCheck,
        detail: budgetDetail,
      },
      {
        label: "Crescimento Patrimonial",
        description: "Evolução dos seus ativos",
        score: Math.round(assetScore),
        weight: 25,
        icon: TrendingUp,
        detail: assetDetail,
      },
      {
        label: "Consistência",
        description: "Regularidade no registro financeiro",
        score: Math.round(consistencyScore),
        weight: 20,
        icon: BarChart3,
        detail: `${activeMonths}/3 meses com lançamentos`,
      },
    ];
  }, [transactions, assets, budgets]);

  const totalScore = Math.round(
    factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0)
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" /> Saúde Financeira
          </h1>
          <p className="text-sm text-muted-foreground">Score baseado nos seus dados reais</p>
        </div>

        {/* Main Score */}
        <Card className="relative overflow-hidden">
          <div className={cn("absolute top-0 left-0 w-full h-1", getScoreBgColor(totalScore))} />
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="currentColor"
                  className={getScoreColor(totalScore)}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(totalScore / 100) * 326.73} 326.73`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-bold", getScoreColor(totalScore))}>{totalScore}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
            </div>
            <Badge className={cn("text-sm px-3 py-1", getScoreBgColor(totalScore), "text-white")}>
              {getScoreLabel(totalScore)}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Baseado nos seus últimos 3 meses de atividade
            </p>
          </CardContent>
        </Card>

        {/* Score factors */}
        <div className="grid gap-3">
          {factors.map(factor => (
            <Card key={factor.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      factor.score >= 70 ? "bg-emerald-500/10 text-emerald-600" :
                      factor.score >= 40 ? "bg-warning/10 text-warning" :
                      "bg-destructive/10 text-destructive"
                    )}>
                      <factor.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">{factor.label}</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-[200px]">
                            {factor.description} (peso: {factor.weight}%)
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{factor.detail}</p>
                    </div>
                  </div>
                  <span className={cn("text-lg font-bold", getScoreColor(factor.score))}>
                    {factor.score}
                  </span>
                </div>
                <Progress value={factor.score} className={cn(
                  "h-2",
                  factor.score >= 70 && "[&>div]:bg-emerald-500",
                  factor.score >= 40 && factor.score < 70 && "[&>div]:bg-warning",
                  factor.score < 40 && "[&>div]:bg-destructive",
                )} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tips */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💡 Dicas para melhorar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {factors.filter(f => f.score < 70).map(f => (
              <div key={f.label} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-warning">•</span>
                <span>
                  {f.label === "Taxa de Poupança" && "Tente poupar pelo menos 20% da sua renda mensal."}
                  {f.label === "Controle de Gastos" && "Defina orçamentos para suas categorias e mantenha-se dentro dos limites."}
                  {f.label === "Crescimento Patrimonial" && "Registre seus ativos regularmente para acompanhar a evolução."}
                  {f.label === "Consistência" && "Registre suas transações todos os meses para ter dados precisos."}
                </span>
              </div>
            ))}
            {factors.every(f => f.score >= 70) && (
              <p className="text-xs text-emerald-600">🎉 Parabéns! Sua saúde financeira está ótima. Continue assim!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
