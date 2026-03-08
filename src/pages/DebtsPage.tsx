import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useReadOnly } from "@/hooks/useReadOnly";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Pencil, Landmark, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO, addMonths, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Debt {
  id: string;
  user_id: string;
  creditor: string;
  total_value: number;
  remaining_value: number;
  installments: number;
  installments_paid: number;
  interest_rate: number;
  start_date: string;
  due_date: string | null;
  notes: string | null;
  status: string;
}

export default function DebtsPage() {
  const { user } = useAuth();
  const { isReadOnly } = useReadOnly();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [creditor, setCreditor] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [remainingValue, setRemainingValue] = useState("");
  const [installments, setInstallments] = useState("");
  const [installmentsPaid, setInstallmentsPaid] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const fetchDebts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("debts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setDebts((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const resetForm = () => {
    setCreditor(""); setTotalValue(""); setRemainingValue(""); setInstallments("");
    setInstallmentsPaid(""); setInterestRate(""); setStartDate(format(new Date(), "yyyy-MM-dd"));
    setDueDate(""); setNotes(""); setEditDebt(null);
  };

  const openEdit = (d: Debt) => {
    setEditDebt(d);
    setCreditor(d.creditor);
    setTotalValue(d.total_value.toString());
    setRemainingValue(d.remaining_value.toString());
    setInstallments(d.installments.toString());
    setInstallmentsPaid(d.installments_paid.toString());
    setInterestRate(d.interest_rate.toString());
    setStartDate(d.start_date);
    setDueDate(d.due_date || "");
    setNotes(d.notes || "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !creditor || !totalValue || parseFloat(totalValue) <= 0) {
      toast.error("Preencha credor e valor total"); return;
    }
    setSaving(true);
    const payload = {
      creditor,
      total_value: parseFloat(totalValue),
      remaining_value: parseFloat(remainingValue || totalValue),
      installments: parseInt(installments || "1"),
      installments_paid: parseInt(installmentsPaid || "0"),
      interest_rate: parseFloat(interestRate || "0"),
      start_date: startDate,
      due_date: dueDate || null,
      notes: notes || null,
    };

    if (editDebt) {
      const { error } = await supabase.from("debts").update(payload as any).eq("id", editDebt.id);
      if (error) toast.error(error.message);
      else toast.success("Dívida atualizada!");
    } else {
      const { error } = await supabase.from("debts").insert({ ...payload, user_id: user.id, status: "active" } as any);
      if (error) toast.error(error.message);
      else toast.success("Dívida cadastrada!");
    }
    setSaving(false);
    resetForm();
    setDialogOpen(false);
    fetchDebts();
  };

  const deleteDebt = async (id: string) => {
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removida!"); fetchDebts(); }
  };

  const markPaid = async (d: Debt) => {
    const { error } = await supabase.from("debts")
      .update({ status: "paid", remaining_value: 0, installments_paid: d.installments } as any)
      .eq("id", d.id);
    if (error) toast.error(error.message);
    else { toast.success("Dívida quitada! 🎉"); fetchDebts(); }
  };

  // Summary
  const activeDebts = debts.filter(d => d.status === "active");
  const paidDebts = debts.filter(d => d.status === "paid");
  const totalDebt = activeDebts.reduce((s, d) => s + Number(d.remaining_value), 0);
  const totalOriginal = activeDebts.reduce((s, d) => s + Number(d.total_value), 0);
  const totalPaid = activeDebts.reduce((s, d) => s + (Number(d.total_value) - Number(d.remaining_value)), 0);

  // Estimated payoff: latest due_date or estimate from installments
  const estimatedPayoff = useMemo(() => {
    if (activeDebts.length === 0) return null;
    let latest = new Date();
    activeDebts.forEach(d => {
      if (d.due_date) {
        const dd = parseISO(d.due_date);
        if (dd > latest) latest = dd;
      } else {
        const remainingInstallments = d.installments - d.installments_paid;
        const est = addMonths(new Date(), remainingInstallments);
        if (est > latest) latest = est;
      }
    });
    return latest;
  }, [activeDebts]);

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" /> Controle de Dívidas
            </h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe suas dívidas e empréstimos até a quitação total
            </p>
          </div>
          {!isReadOnly && (
            <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova Dívida</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editDebt ? "Editar" : "Nova"} Dívida</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Credor *</Label>
                    <Input placeholder="Ex: Banco do Brasil" value={creditor} onChange={e => setCreditor(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Valor Total (R$) *</Label>
                      <Input type="number" step="0.01" min="0.01" placeholder="15000" value={totalValue} onChange={e => setTotalValue(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Restante (R$)</Label>
                      <Input type="number" step="0.01" min="0" placeholder="Auto" value={remainingValue} onChange={e => setRemainingValue(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Parcelas</Label>
                      <Input type="number" min="1" placeholder="36" value={installments} onChange={e => setInstallments(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Parcelas Pagas</Label>
                      <Input type="number" min="0" placeholder="0" value={installmentsPaid} onChange={e => setInstallmentsPaid(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Juros (% a.m.)</Label>
                      <Input type="number" step="0.01" min="0" placeholder="1.5" value={interestRate} onChange={e => setInterestRate(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Data Início</Label>
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Data Prevista Quitação</Label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input placeholder="Notas adicionais" value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <Button onClick={handleSubmit} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editDebt ? "Salvar" : "Cadastrar Dívida"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Summary Cards */}
        {debts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Dívida Total Ativa</p>
                <p className="text-xl font-bold text-destructive">{fmtCurrency(totalDebt)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Já Pago</p>
                <p className="text-xl font-bold text-success">{fmtCurrency(totalPaid)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Dívidas Ativas</p>
                <p className="text-xl font-bold">{activeDebts.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Quitação Estimada</p>
                <p className="text-xl font-bold">
                  {estimatedPayoff ? format(estimatedPayoff, "MMM yyyy", { locale: ptBR }) : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Overall progress */}
        {activeDebts.length > 0 && totalOriginal > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4" /> Progresso Geral de Quitação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Progress value={(totalPaid / totalOriginal) * 100} className="h-3 flex-1" />
                <span className="text-sm font-bold min-w-[50px] text-right">
                  {((totalPaid / totalOriginal) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {fmtCurrency(totalPaid)} de {fmtCurrency(totalOriginal)} quitados
              </p>
            </CardContent>
          </Card>
        )}

        {/* Debt list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : debts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Landmark className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma dívida cadastrada</p>
              <p className="text-xs text-muted-foreground mt-1">Cadastre suas dívidas para acompanhar a quitação</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {debts.map(d => {
              const total = Number(d.total_value);
              const remaining = Number(d.remaining_value);
              const paid = total - remaining;
              const pct = total > 0 ? (paid / total) * 100 : 0;
              const isPaid = d.status === "paid";
              const installRemaining = d.installments - d.installments_paid;
              const monthlyPayment = installRemaining > 0 ? remaining / installRemaining : 0;

              return (
                <Card key={d.id} className={cn(
                  "transition-all",
                  isPaid && "border-success/50 bg-success/5 opacity-75",
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.creditor}</span>
                        {isPaid && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-success text-success">
                            <CheckCircle2 className="h-3 w-3" /> Quitada
                          </Badge>
                        )}
                        {!isPaid && d.interest_rate > 0 && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-warning text-warning">
                            {d.interest_rate}% a.m.
                          </Badge>
                        )}
                      </div>
                      {!isReadOnly && !isPaid && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => markPaid(d)} title="Marcar como quitada">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => deleteDebt(d.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {!isReadOnly && isPaid && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => deleteDebt(d.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-1">
                      <Progress value={Math.min(pct, 100)} className={cn("h-2.5 flex-1", isPaid && "[&>div]:bg-success")} />
                      <span className="text-xs font-bold min-w-[40px] text-right text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{fmtCurrency(paid)} pago</span>
                      <span className={cn(remaining > 0 ? "text-destructive font-medium" : "text-success")}>
                        {remaining > 0 ? `${fmtCurrency(remaining)} restante` : "Quitada!"}
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                      <span>
                        {d.installments_paid}/{d.installments} parcelas
                        {monthlyPayment > 0 && !isPaid && ` • ~${fmtCurrency(monthlyPayment)}/mês`}
                      </span>
                      {d.due_date && (
                        <span>Quitação: {format(parseISO(d.due_date), "MM/yyyy")}</span>
                      )}
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
