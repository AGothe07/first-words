import { useState } from "react";
import { useFinance } from "@/contexts/FinanceContext";
import { Transaction, TransactionType } from "@/types/finance";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useThrottle } from "@/hooks/useDebounce";

interface Props {
  editTransaction?: Transaction;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export function TransactionForm({ editTransaction, onClose, trigger }: Props) {
  const { addTransaction, updateTransaction, categories, subcategories, persons } = useFinance();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<TransactionType>(editTransaction?.type || "expense");
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(editTransaction?.amount?.toString() || "");
  const [personId, setPersonId] = useState(editTransaction?.person_id || "");
  const [categoryId, setCategoryId] = useState(editTransaction?.category_id || "");
  const [subcategoryId, setSubcategoryId] = useState(editTransaction?.subcategory_id || "");
  const [notes, setNotes] = useState(editTransaction?.notes || "");

  const activePersons = persons.filter(p => p.is_active);
  const activeCategories = categories.filter(c => c.is_active && c.type === type);
  const activeSubs = subcategories.filter(s => s.is_active && s.category_id === categoryId);

  const reset = () => {
    setType("expense"); setDate(new Date().toISOString().slice(0, 10));
    setAmount(""); setPersonId(""); setCategoryId(""); setSubcategoryId(""); setNotes("");
  };

  const handleSubmit = useThrottle(async () => {
    if (!date || !amount || !personId || !categoryId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    const data = {
      type, date, amount: parseFloat(amount), person_id: personId,
      category_id: categoryId, subcategory_id: subcategoryId || null, notes: notes || undefined,
    };

    if (editTransaction) {
      await updateTransaction({ ...editTransaction, ...data });
    } else {
      await addTransaction(data as any);
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
      <DialogContent className="sm:max-w-md">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

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

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea placeholder="Opcional..." value={notes} onChange={e => setNotes(e.target.value)} className="text-sm h-16 resize-none" maxLength={500} />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={saving || noPersons || noCategories}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editTransaction ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
