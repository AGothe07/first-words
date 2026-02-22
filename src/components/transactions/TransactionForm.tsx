import { useState } from "react";
import { useFinance } from "@/contexts/FinanceContext";
import { useDimensions } from "@/contexts/DimensionsContext";
import { Transaction, TransactionType } from "@/types/finance";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, X, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useThrottle } from "@/hooks/useDebounce";
import { addMonths, format, parseISO } from "date-fns";

interface Props {
  editTransaction?: Transaction;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export function TransactionForm({ editTransaction, onClose, trigger }: Props) {
  const { addTransaction, addTransactionsBulk, updateTransaction, categories, subcategories, persons } = useFinance();
  const { isDimensionActive, isDimensionRequired, paymentMethods, accounts, projects, tags } = useDimensions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<TransactionType>(editTransaction?.type || "expense");
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(editTransaction?.amount?.toString() || "");
  const [personId, setPersonId] = useState(editTransaction?.person_id || "");
  const [categoryId, setCategoryId] = useState(editTransaction?.category_id || "");
  const [subcategoryId, setSubcategoryId] = useState(editTransaction?.subcategory_id || "");
  const [paymentMethodId, setPaymentMethodId] = useState(editTransaction?.payment_method_id || "");
  const [accountId, setAccountId] = useState(editTransaction?.account_id || "");
  const [projectId, setProjectId] = useState(editTransaction?.project_id || "");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState(editTransaction?.notes || "");

  // Installment state
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("2");
  const [installmentValue, setInstallmentValue] = useState("");
  const [installmentMode, setInstallmentMode] = useState<"total" | "parcel">("total"); // total = user enters total, parcel = user enters parcel value
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [showCustomDates, setShowCustomDates] = useState(false);

  const activePersons = persons.filter(p => p.is_active);
  const activeCategories = categories.filter(c => c.is_active && c.type === type);
  const activeSubs = subcategories.filter(s => s.is_active && s.category_id === categoryId);
  const activePaymentMethods = paymentMethods.filter(p => p.is_active);
  const activeAccounts = accounts.filter(a => a.is_active);
  const activeProjects = projects.filter(p => p.is_active);

  const parsedCount = parseInt(installmentCount) || 2;

  // Calculate display values
  const totalValue = installmentMode === "total"
    ? parseFloat(amount) || 0
    : (parseFloat(installmentValue) || 0) * parsedCount;

  const parcelValue = installmentMode === "total"
    ? (parseFloat(amount) || 0) / parsedCount
    : parseFloat(installmentValue) || 0;

  // Generate default dates (monthly from start date)
  const generateDates = (startDate: string, count: number): string[] => {
    const start = parseISO(startDate);
    return Array.from({ length: count }, (_, i) => format(addMonths(start, i), "yyyy-MM-dd"));
  };

  const installmentDates = showCustomDates && customDates.length === parsedCount
    ? customDates
    : generateDates(date, parsedCount);

  // When count changes, update custom dates array
  const handleCountChange = (val: string) => {
    setInstallmentCount(val);
    const count = parseInt(val) || 2;
    if (showCustomDates) {
      setCustomDates(generateDates(date, count));
    }
  };

  const handleToggleCustomDates = (checked: boolean) => {
    setShowCustomDates(checked);
    if (checked) {
      setCustomDates(generateDates(date, parsedCount));
    }
  };

  const reset = () => {
    setType("expense"); setDate(new Date().toISOString().slice(0, 10));
    setAmount(""); setPersonId(""); setCategoryId(""); setSubcategoryId("");
    setPaymentMethodId(""); setAccountId(""); setProjectId(""); setSelectedTags([]);
    setNotes(""); setIsInstallment(false); setInstallmentCount("2");
    setInstallmentValue(""); setInstallmentMode("total"); setCustomDates([]);
    setShowCustomDates(false);
  };

  const handleSubmit = useThrottle(async () => {
    if (!date || !personId || !categoryId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (isInstallment) {
      if (parsedCount < 2 || parsedCount > 120) {
        toast.error("Número de parcelas deve ser entre 2 e 120");
        return;
      }
      if (parcelValue <= 0) {
        toast.error("Valor da parcela deve ser maior que zero");
        return;
      }
    } else {
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Valor deve ser maior que zero");
        return;
      }
    }

    if (isDimensionActive("payment_method") && isDimensionRequired("payment_method") && !paymentMethodId) {
      toast.error("Selecione a forma de pagamento"); return;
    }
    if (isDimensionActive("account") && isDimensionRequired("account") && !accountId) {
      toast.error("Selecione a conta"); return;
    }
    if (isDimensionActive("project") && isDimensionRequired("project") && !projectId) {
      toast.error("Selecione o projeto"); return;
    }

    setSaving(true);

    if (isInstallment && !editTransaction) {
      const groupId = crypto.randomUUID();
      const dates = installmentDates;
      const items = dates.map((d, i) => ({
        type,
        date: d,
        amount: Math.round(parcelValue * 100) / 100,
        person_id: personId,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        notes: notes ? `${notes} (${i + 1}/${parsedCount})` : `Parcela ${i + 1}/${parsedCount}`,
        payment_method_id: paymentMethodId || null,
        account_id: accountId || null,
        project_id: projectId || null,
        installment_group_id: groupId,
        installment_number: i + 1,
        installment_total: parsedCount,
      }));
      await addTransactionsBulk(items as any);
    } else {
      const data = {
        type, date, amount: parseFloat(amount), person_id: personId,
        category_id: categoryId, subcategory_id: subcategoryId || null, notes: notes || undefined,
        payment_method_id: paymentMethodId || null,
        account_id: accountId || null,
        project_id: projectId || null,
      };

      if (editTransaction) {
        await updateTransaction({ ...editTransaction, ...data });
      } else {
        await addTransaction(data as any);
      }
    }

    setSaving(false);
    reset();
    setOpen(false);
    onClose?.();
  }, 1000);

  const noPersons = activePersons.length === 0;
  const noCategories = activeCategories.length === 0;

  return (
    <Dialog open={editTransaction ? true : open} onOpenChange={v => { if (!editTransaction) setOpen(v); else if (!v) onClose?.(); }}>
      {!editTransaction && (
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Novo Lançamento
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTransaction ? "Editar" : "Novo"} Lançamento</DialogTitle>
        </DialogHeader>

        <Tabs value={type} onValueChange={v => { setType(v as TransactionType); setCategoryId(""); setSubcategoryId(""); }}>
          <TabsList className="w-full">
            <TabsTrigger value="expense" className="flex-1">Gasto</TabsTrigger>
            <TabsTrigger value="income" className="flex-1">Receita</TabsTrigger>
          </TabsList>
        </Tabs>

        {(noPersons || noCategories) && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {noPersons && <p>⚠️ Cadastre ao menos uma pessoa antes de lançar.</p>}
            {noCategories && <p>⚠️ Cadastre ao menos uma categoria de {type === "expense" ? "gasto" : "receita"} antes de lançar.</p>}
          </div>
        )}

        <div className="space-y-3 mt-2">
          {/* Installment toggle - only for new expense */}
          {!editTransaction && type === "expense" && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium">Despesa Parcelada</Label>
              </div>
              <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{isInstallment ? "Data 1ª parcela *" : "Data *"}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">
                {isInstallment ? (installmentMode === "total" ? "Valor Total (R$) *" : "Valor da Parcela (R$) *") : "Valor (R$) *"}
              </Label>
              <Input
                type="number" step="0.01" min="0.01" placeholder="0,00"
                value={isInstallment ? (installmentMode === "total" ? amount : installmentValue) : amount}
                onChange={e => {
                  if (isInstallment && installmentMode === "parcel") {
                    setInstallmentValue(e.target.value);
                  } else {
                    setAmount(e.target.value);
                  }
                }}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Installment details */}
          {isInstallment && !editTransaction && (
            <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nº de Parcelas *</Label>
                  <Input
                    type="number" min="2" max="120" value={installmentCount}
                    onChange={e => handleCountChange(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Modo</Label>
                  <Select value={installmentMode} onValueChange={v => setInstallmentMode(v as "total" | "parcel")}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Informar Total</SelectItem>
                      <SelectItem value="parcel">Informar Parcela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Calculated summary */}
              {(parseFloat(amount) > 0 || parseFloat(installmentValue) > 0) && (
                <div className="text-xs text-muted-foreground bg-background/80 p-2 rounded space-y-1">
                  <p>💳 <strong>{parsedCount}x</strong> de <strong>R$ {parcelValue.toFixed(2)}</strong></p>
                  <p>📊 Total: <strong>R$ {totalValue.toFixed(2)}</strong></p>
                </div>
              )}

              {/* Custom dates toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Personalizar datas</Label>
                <Switch checked={showCustomDates} onCheckedChange={handleToggleCustomDates} />
              </div>

              {showCustomDates && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {customDates.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-12">P{i + 1}/{parsedCount}</span>
                      <Input
                        type="date" value={d}
                        onChange={e => {
                          const updated = [...customDates];
                          updated[i] = e.target.value;
                          setCustomDates(updated);
                        }}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">Pessoa *</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {activePersons.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria *</Label>
              <Select value={categoryId} onValueChange={v => { setCategoryId(v); setSubcategoryId(""); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeSubs.length > 0 && (
              <div>
                <Label className="text-xs">Subcategoria</Label>
                <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {activeSubs.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Dynamic dimension fields */}
          {isDimensionActive("payment_method") && activePaymentMethods.length > 0 && (
            <div>
              <Label className="text-xs">
                Forma de Pagamento {isDimensionRequired("payment_method") ? "*" : ""}
              </Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activePaymentMethods.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isDimensionActive("account") && activeAccounts.length > 0 && (
            <div>
              <Label className="text-xs">
                Conta / Cartão {isDimensionRequired("account") ? "*" : ""}
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isDimensionActive("project") && activeProjects.length > 0 && (
            <div>
              <Label className="text-xs">
                Projeto {isDimensionRequired("project") ? "*" : ""}
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isDimensionActive("tags") && tags.length > 0 && (
            <div>
              <Label className="text-xs">Tags</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map(tag => {
                  const selected = selectedTags.includes(tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => setSelectedTags(prev =>
                        selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                      )}
                    >
                      <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                      {selected && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea placeholder="Opcional..." value={notes} onChange={e => setNotes(e.target.value)} className="text-sm h-16 resize-none" maxLength={500} />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={saving || noPersons || noCategories}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editTransaction ? "Salvar" : isInstallment ? `Criar ${parsedCount} Parcelas` : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
