import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useFinance } from "@/contexts/FinanceContext";
import { useDimensions } from "@/contexts/DimensionsContext";
import { useReadOnly } from "@/hooks/useReadOnly";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Pencil, Trash2, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TransactionType } from "@/types/finance";

interface RecurringTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  person_id: string;
  category_id: string;
  subcategory_id: string | null;
  payment_method_id: string | null;
  account_id: string | null;
  project_id: string | null;
  notes: string | null;
  frequency: string;
  interval_value: number;
  next_due_date: string;
  end_date: string | null;
  is_active: boolean;
  last_generated_at: string | null;
  created_at: string;
}

const frequencyLabels: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  annual: "Anual",
};

export default function RecurringTransactionsPage() {
  const { user } = useAuth();
  const { categories, subcategories, persons } = useFinance();
  const { isDimensionActive, paymentMethods, accounts, projects } = useDimensions();
  const { isReadOnly } = useReadOnly();

  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringTransaction | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [personId, setPersonId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("next_due_date");
    if (error) { toast.error(error.message); }
    else setItems((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setType("expense"); setAmount(""); setPersonId(""); setCategoryId("");
    setSubcategoryId(""); setPaymentMethodId(""); setAccountId(""); setProjectId("");
    setNotes(""); setFrequency("monthly"); setIntervalValue("1");
    setNextDueDate(new Date().toISOString().slice(0, 10)); setEndDate("");
    setEditItem(null);
  };

  const openEdit = (item: RecurringTransaction) => {
    setEditItem(item);
    setType(item.type as TransactionType);
    setAmount(item.amount.toString());
    setPersonId(item.person_id);
    setCategoryId(item.category_id);
    setSubcategoryId(item.subcategory_id || "");
    setPaymentMethodId(item.payment_method_id || "");
    setAccountId(item.account_id || "");
    setProjectId(item.project_id || "");
    setNotes(item.notes || "");
    setFrequency(item.frequency);
    setIntervalValue(item.interval_value.toString());
    setNextDueDate(item.next_due_date);
    setEndDate(item.end_date || "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !personId || !categoryId || !amount || parseFloat(amount) <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);

    const data = {
      user_id: user.id,
      type,
      amount: parseFloat(amount),
      person_id: personId,
      category_id: categoryId,
      subcategory_id: subcategoryId || null,
      payment_method_id: paymentMethodId || null,
      account_id: accountId || null,
      project_id: projectId || null,
      notes: notes || null,
      frequency,
      interval_value: parseInt(intervalValue) || 1,
      next_due_date: nextDueDate,
      end_date: endDate || null,
      is_active: true,
    };

    if (editItem) {
      const { error } = await supabase.from("recurring_transactions").update(data as any).eq("id", editItem.id);
      if (error) toast.error(error.message);
      else toast.success("Recorrência atualizada!");
    } else {
      const { error } = await supabase.from("recurring_transactions").insert(data as any);
      if (error) toast.error(error.message);
      else toast.success("Recorrência criada!");
    }

    setSaving(false);
    resetForm();
    setDialogOpen(false);
    fetchItems();
  };

  const toggleActive = async (item: RecurringTransaction) => {
    const { error } = await supabase
      .from("recurring_transactions")
      .update({ is_active: !item.is_active } as any)
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success(item.is_active ? "Pausada" : "Reativada"); fetchItems(); }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluída!"); fetchItems(); }
  };

  const getName = (id: string, list: { id: string; name: string }[]) =>
    list.find(i => i.id === id)?.name || "—";

  const activePersons = persons.filter(p => p.is_active);
  const activeCategories = categories.filter(c => c.is_active && c.type === type);
  const activeSubs = subcategories.filter(s => s.is_active && s.category_id === categoryId);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lançamentos Recorrentes</h1>
          <p className="text-sm text-muted-foreground">Gastos e receitas que se repetem automaticamente</p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Nova Recorrência
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editItem ? "Editar" : "Nova"} Recorrência</DialogTitle>
              </DialogHeader>

              <Tabs value={type} onValueChange={v => { setType(v as TransactionType); setCategoryId(""); setSubcategoryId(""); }}>
                <TabsList className="w-full">
                  <TabsTrigger value="expense" className="flex-1">Gasto</TabsTrigger>
                  <TabsTrigger value="income" className="flex-1">Receita</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor (R$) *</Label>
                    <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={amount}
                      onChange={e => setAmount(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Frequência *</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">A cada (intervalo)</Label>
                    <Input type="number" min="1" max="12" value={intervalValue}
                      onChange={e => setIntervalValue(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Próximo vencimento *</Label>
                    <Input type="date" value={nextDueDate}
                      onChange={e => setNextDueDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Data final (opcional)</Label>
                  <Input type="date" value={endDate}
                    onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
                </div>

                <div>
                  <Label className="text-xs">Pessoa *</Label>
                  <Select value={personId} onValueChange={setPersonId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {activePersons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Categoria *</Label>
                    <Select value={categoryId} onValueChange={v => { setCategoryId(v); setSubcategoryId(""); }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {activeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeSubs.length > 0 && (
                    <div>
                      <Label className="text-xs">Subcategoria</Label>
                      <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          {activeSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {isDimensionActive("payment_method") && paymentMethods.filter(p => p.is_active).length > 0 && (
                  <div>
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isDimensionActive("account") && accounts.filter(a => a.is_active).length > 0 && (
                  <div>
                    <Label className="text-xs">Conta / Cartão</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.is_active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isDimensionActive("project") && projects.filter(p => p.is_active).length > 0 && (
                  <div>
                    <Label className="text-xs">Projeto</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {projects.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ex: Aluguel, Netflix..." className="text-sm" rows={2} />
                </div>

                <Button onClick={handleSubmit} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editItem ? "Salvar Alterações" : "Criar Recorrência"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma recorrência cadastrada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie lançamentos que se repetem automaticamente</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Próximo</TableHead>
                    <TableHead>Fim</TableHead>
                    {!isReadOnly && <TableHead className="w-24">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <Badge variant={item.is_active ? "default" : "secondary"}>
                          {item.is_active ? "Ativa" : "Pausada"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.type === "expense" ? "destructive" : "default"}>
                          {item.type === "expense" ? "Gasto" : "Receita"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{getName(item.category_id, categories)}</div>
                        <div className="text-xs text-muted-foreground">{getName(item.person_id, persons)}</div>
                        {item.notes && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.notes}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        R$ {Number(item.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.interval_value > 1 ? `A cada ${item.interval_value} ` : ""}
                        {frequencyLabels[item.frequency] || item.frequency}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(item.next_due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.end_date ? new Date(item.end_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => toggleActive(item)}
                              title={item.is_active ? "Pausar" : "Reativar"}>
                              {item.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => openEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => deleteItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
