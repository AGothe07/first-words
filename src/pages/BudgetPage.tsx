import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useFinance } from "@/contexts/FinanceContext";
import { useReadOnly } from "@/hooks/useReadOnly";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, PiggyBank, AlertTriangle, TrendingUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, format, parseISO, isWithinInterval } from "date-fns";

interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  period: string;
}

export default function BudgetPage() {
  const { user } = useAuth();
  const { categories, transactions } = useFinance();
  const { isReadOnly } = useReadOnly();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Current month range
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const currentPeriod = format(now, "yyyy-MM");

  const fetchBudgets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id)
      .eq("period", "monthly");
    if (error) toast.error(error.message);
    else setBudgets((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  // Calculate spent per category for current month
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      if (t.type !== "expense") return;
      const d = parseISO(t.date);
      if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) return;
      map.set(t.category_id, (map.get(t.category_id) || 0) + Number(t.amount));
    });
    return map;
  }, [transactions, monthStart, monthEnd]);

  const expenseCategories = categories.filter(c => c.type === "expense" && c.is_active);
  const budgetedCategoryIds = budgets.map(b => b.category_id);
  const availableCategories = expenseCategories.filter(c => !budgetedCategoryIds.includes(c.id) || (editBudget && editBudget.category_id === c.id));

  const resetForm = () => {
    setCategoryId(""); setAmount(""); setEditBudget(null);
  };

  const handleSubmit = async () => {
    if (!user || !categoryId || !amount || parseFloat(amount) <= 0) {
      toast.error("Preencha categoria e valor"); return;
    }
    setSaving(true);

    if (editBudget) {
      const { error } = await supabase.from("budgets")
        .update({ amount: parseFloat(amount), category_id: categoryId } as any)
        .eq("id", editBudget.id);
      if (error) toast.error(error.message);
      else toast.success("Orçamento atualizado!");
    } else {
      const { error } = await supabase.from("budgets").insert({
        user_id: user.id,
        category_id: categoryId,
        amount: parseFloat(amount),
        period: "monthly",
      } as any);
      if (error) toast.error(error.message.includes("duplicate") ? "Já existe orçamento para essa categoria" : error.message);
      else toast.success("Orçamento definido!");
    }

    setSaving(false);
    resetForm();
    setDialogOpen(false);
    fetchBudgets();
  };

  const deleteBudget = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido!"); fetchBudgets(); }
  };

  const openEdit = (b: Budget) => {
    setEditBudget(b);
    setCategoryId(b.category_id);
    setAmount(b.amount.toString());
    setDialogOpen(true);
  };

  // Summary calculations
  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + (spentByCategory.get(b.category_id) || 0), 0);
  const totalPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  // Sort budgets by % used descending
  const sortedBudgets = [...budgets].sort((a, b) => {
    const pctA = (spentByCategory.get(a.category_id) || 0) / Number(a.amount);
    const pctB = (spentByCategory.get(b.category_id) || 0) / Number(b.amount);
    return pctB - pctA;
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <PiggyBank className="h-6 w-6 text-primary" /> Orçamento Mensal
            </h1>
            <p className="text-sm text-muted-foreground">
              Defina limites por categoria e acompanhe seus gastos — {format(now, "MMMM yyyy")}
            </p>
          </div>
          {!isReadOnly && (
            <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> Definir Orçamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>{editBudget ? "Editar" : "Novo"} Orçamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Categoria de Gasto *</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {availableCategories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Limite mensal (R$) *</Label>
                    <Input type="number" step="0.01" min="0.01" placeholder="Ex: 800"
                      value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <Button onClick={handleSubmit} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editBudget ? "Salvar" : "Definir Orçamento"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Summary Cards */}
        {budgets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Orçamento Total</p>
                <p className="text-xl font-bold">R$ {totalBudgeted.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Gasto</p>
                <p className={cn("text-xl font-bold", totalPct > 100 ? "text-destructive" : totalPct > 80 ? "text-warning" : "text-foreground")}>
                  R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Disponível</p>
                <p className={cn("text-xl font-bold", (totalBudgeted - totalSpent) < 0 ? "text-destructive" : "text-success")}>
                  R$ {(totalBudgeted - totalSpent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Budget progress overview */}
        {budgets.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Uso Total do Orçamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Progress value={Math.min(totalPct, 100)} className={cn(
                  "h-3 flex-1",
                  totalPct > 100 && "[&>div]:bg-destructive",
                  totalPct > 80 && totalPct <= 100 && "[&>div]:bg-warning",
                )} />
                <span className={cn(
                  "text-sm font-bold min-w-[50px] text-right",
                  totalPct > 100 ? "text-destructive" : totalPct > 80 ? "text-warning" : "text-foreground"
                )}>
                  {totalPct.toFixed(0)}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Individual budgets */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : budgets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PiggyBank className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum orçamento definido</p>
              <p className="text-xs text-muted-foreground mt-1">Defina limites por categoria para controlar seus gastos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sortedBudgets.map(b => {
              const cat = categories.find(c => c.id === b.category_id);
              const spent = spentByCategory.get(b.category_id) || 0;
              const limit = Number(b.amount);
              const pct = limit > 0 ? (spent / limit) * 100 : 0;
              const remaining = limit - spent;
              const isOver = pct > 100;
              const isWarning = pct > 80 && !isOver;

              return (
                <Card key={b.id} className={cn(
                  "transition-all",
                  isOver && "border-destructive/50 bg-destructive/5",
                  isWarning && "border-warning/50 bg-warning/5",
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{cat?.name || "?"}</span>
                        {isOver && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> Estourado
                          </Badge>
                        )}
                        {isWarning && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-warning text-warning">
                            <AlertTriangle className="h-3 w-3" /> Atenção
                          </Badge>
                        )}
                      </div>
                      {!isReadOnly && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => deleteBudget(b.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-1">
                      <Progress value={Math.min(pct, 100)} className={cn(
                        "h-2.5 flex-1",
                        isOver && "[&>div]:bg-destructive",
                        isWarning && "[&>div]:bg-warning",
                      )} />
                      <span className={cn(
                        "text-xs font-bold min-w-[40px] text-right",
                        isOver ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground"
                      )}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>R$ {spent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} gasto</span>
                      <span className={cn(remaining < 0 ? "text-destructive font-medium" : "")}>
                        {remaining >= 0
                          ? `R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} disponível`
                          : `R$ ${Math.abs(remaining).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} acima`
                        }
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1">
                      Limite: R$ {limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
