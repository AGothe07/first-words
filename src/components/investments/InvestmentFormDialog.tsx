import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvestments } from "@/contexts/InvestmentsContext";
import { INVESTMENT_TYPES } from "@/types/investments";
import { Plus } from "lucide-react";
import { format } from "date-fns";

interface Props {
  editInvestment?: { id: string; name: string; type: string; notes: string | null };
  trigger?: React.ReactNode;
  onClose?: () => void;
}

export function InvestmentFormDialog({ editInvestment, trigger, onClose }: Props) {
  const { addInvestment, updateInvestment, addEntry } = useInvestments();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editInvestment?.name ?? "");
  const [type, setType] = useState(editInvestment?.type ?? "stock");
  const [notes, setNotes] = useState(editInvestment?.notes ?? "");
  const [initialAmount, setInitialAmount] = useState("");
  const [initialDate, setInitialDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  const isEdit = !!editInvestment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateInvestment({ id: editInvestment.id, name, type, notes: notes || null });
      } else {
        const id = await addInvestment({ name, type, notes: notes || null });
        if (id && initialAmount && Number(initialAmount) > 0) {
          await addEntry({ investment_id: id, amount: Number(initialAmount), date: initialDate, notes: null });
        }
      }
      setOpen(false);
      onClose?.();
      if (!isEdit) { setName(""); setType("stock"); setNotes(""); setInitialAmount(""); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onClose?.(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Investimento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Investimento" : "Novo Investimento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Ativo</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: PETR4, Bitcoin, CDB Banco X" required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVESTMENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Aporte Inicial (R$)</Label>
                <Input type="number" min="0" step="0.01" value={initialAmount} onChange={e => setInitialAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={initialDate} onChange={e => setInitialDate(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar Investimento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
