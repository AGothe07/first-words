import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInvestments } from "@/contexts/InvestmentsContext";
import { InvestmentEntry } from "@/types/investments";
import { Plus } from "lucide-react";
import { format } from "date-fns";

interface Props {
  investmentId: string;
  investmentName: string;
  editEntry?: InvestmentEntry;
  trigger?: React.ReactNode;
  onClose?: () => void;
}

export function EntryFormDialog({ investmentId, investmentName, editEntry, trigger, onClose }: Props) {
  const { addEntry, updateEntry } = useInvestments();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(editEntry ? String(editEntry.amount) : "");
  const [date, setDate] = useState(editEntry?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = !!editEntry;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateEntry({ id: editEntry.id, amount: Number(amount), date, notes: notes || null });
      } else {
        await addEntry({ investment_id: investmentId, amount: Number(amount), date, notes: notes || null });
      }
      setOpen(false);
      onClose?.();
      if (!isEdit) { setAmount(""); setNotes(""); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onClose?.(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Aporte
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Aporte" : `Novo Aporte — ${investmentName}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
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
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Registrar Aporte"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
