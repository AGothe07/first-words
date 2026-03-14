import { useState } from "react";
import { useInvestments } from "@/contexts/InvestmentsContext";
import { getInvestmentTypeLabel } from "@/types/investments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvestmentFormDialog } from "./InvestmentFormDialog";
import { EntryFormDialog } from "./EntryFormDialog";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentTable({ readOnly = false }: { readOnly?: boolean }) {
  const { filteredInvestments, deleteInvestment, getEntriesForInvestment, deleteEntry } = useInvestments();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "inv" | "entry"; id: string; name: string } | null>(null);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "inv") await deleteInvestment(confirmDelete.id);
    else await deleteEntry(confirmDelete.id);
    setConfirmDelete(null);
  };

  if (filteredInvestments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum investimento encontrado. Clique em "Novo Investimento" para começar.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Ativo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Total Investido</TableHead>
            <TableHead className="text-center">Aportes</TableHead>
            <TableHead>Último Aporte</TableHead>
            {!readOnly && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredInvestments.map(inv => {
            const isExpanded = expandedId === inv.id;
            const invEntries = getEntriesForInvestment(inv.id);
            return (
              <>
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <TableCell>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="font-medium">{inv.name}</TableCell>
                  <TableCell><Badge variant="secondary">{getInvestmentTypeLabel(inv.type)}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(inv.total_invested)}</TableCell>
                  <TableCell className="text-center">{inv.entry_count}</TableCell>
                  <TableCell>{inv.last_entry_date ? format(parseISO(inv.last_entry_date), "dd/MM/yyyy") : "—"}</TableCell>
                  {!readOnly && (
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <EntryFormDialog investmentId={inv.id} investmentName={inv.name} />
                        <InvestmentFormDialog editInvestment={inv} trigger={<Button size="icon" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete({ type: "inv", id: inv.id, name: inv.name })}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && invEntries.length > 0 && invEntries.map(entry => (
                  <TableRow key={entry.id} className="bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={2} className="text-sm text-muted-foreground pl-8">
                      Aporte em {format(parseISO(entry.date), "dd MMM yyyy", { locale: ptBR })}
                      {entry.notes && <span className="ml-2 italic">— {entry.notes}</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(entry.amount)}</TableCell>
                    <TableCell />
                    <TableCell />
                    {!readOnly && (
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <EntryFormDialog investmentId={inv.id} investmentName={inv.name} editEntry={entry} trigger={<Button size="icon" variant="ghost"><Pencil className="h-3 w-3" /></Button>} />
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDelete({ type: "entry", id: entry.id, name: `aporte de ${fmt(entry.amount)}` })}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {isExpanded && invEntries.length === 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={readOnly ? 6 : 7} className="text-center text-sm text-muted-foreground py-3">
                      Nenhum aporte registrado
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{confirmDelete?.name}</strong>?
            {confirmDelete?.type === "inv" && " Todos os aportes associados também serão removidos."}
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
