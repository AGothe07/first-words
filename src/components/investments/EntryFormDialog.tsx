import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvestments } from "@/contexts/InvestmentsContext";
import { InvestmentEntry, InvestmentEntryType, ENTRY_TYPE_LABELS } from "@/types/investments";
import { Plus } from "lucide-react";
import { format } from "date-fns";

interface Props {
  investmentId: string;
  investmentName: string;
  editEntry?: InvestmentEntry;
  trigger?: React.ReactNode;
  defaultEntryType?: InvestmentEntryType;
  onClose?: () => void;
}

export function EntryFormDialog({ investmentId, investmentName, editEntry, trigger, defaultEntryType = "buy", onClose }: Props) {
  const { addEntry, updateEntry } = useInvestments();
  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState<InvestmentEntryType>(editEntry?.entry_type ?? defaultEntryType);
  const [amount, setAmount] = useState(editEntry ? String(editEntry.amount) : "");
  const [quantity, setQuantity] = useState(editEntry?.quantity != null ? String(editEntry.quantity) : "");
  const [date, setDate] = useState(editEntry?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = !!editEntry;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      const qty = quantity ? Number(quantity) : null;
      if (isEdit) {
        await updateEntry({ id: editEntry.id, amount: Number(amount), date, notes: notes || null, entry_type: entryType, quantity: qty });
      } else {
        await addEntry({ investment_id: investmentId, amount: Number(amount), date, notes: notes || null, entry_type: entryType, quantity: qty });
      }
      setOpen(false);
      onClose?.();
      if (!isEdit) { setAmount(""); setQuantity(""); setNotes(""); }
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = entryType === "buy" ? "Compra" : entryType === "sell" ? "Venda" : "Rendimento";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onClose?.(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Lançamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${typeLabel}` : `Novo Lançamento — ${investmentName}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Lançamento</Label>
            <Select value={entryType} onValueChange={(v) => setEntryType(v as InvestmentEntryType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(ENTRY_TYPE_LABELS) as [InvestmentEntryType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min="0.0001" step="0.0001" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Salvando..." : isEdit ? "Salvar" : `Registrar ${typeLabel}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
