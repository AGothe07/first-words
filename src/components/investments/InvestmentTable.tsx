import { useState } from "react";
import { useInvestments } from "@/contexts/InvestmentsContext";
import { getInvestmentTypeLabel, getEntryTypeLabel, InvestmentEntryType, INVESTMENT_TYPES } from "@/types/investments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvestmentFormDialog } from "./InvestmentFormDialog";
import { EntryFormDialog } from "./EntryFormDialog";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const entryTypeBadgeVariant: Record<InvestmentEntryType, "default" | "destructive" | "secondary"> = {
  buy: "default",
  sell: "destructive",
  dividend: "secondary",
};

export function InvestmentTable({ readOnly = false }: { readOnly?: boolean }) {
  const { filteredInvestments, deleteInvestment, getEntriesForInvestment, deleteEntry, bulkDeleteEntries, entries, investments } = useInvestments();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "inv" | "entry"; id: string; name: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "inv") await deleteInvestment(confirmDelete.id);
    else await deleteEntry(confirmDelete.id);
    setConfirmDelete(null);
  };

  // Bulk delete logic
  const entriesForCategory = bulkCategory
    ? entries.filter(e => {
        const inv = investments.find(i => i.id === e.investment_id);
        return inv && inv.type === bulkCategory;
      })
    : [];

  const toggleEntrySelection = (id: string) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllEntries = () => {
    if (selectedEntryIds.size === entriesForCategory.length) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(entriesForCategory.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    await bulkDeleteEntries(Array.from(selectedEntryIds));
    setBulkDeleting(false);
    setSelectedEntryIds(new Set());
    setBulkCategory("");
    setBulkDeleteOpen(false);
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
      {!readOnly && (
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir em massa
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Ativo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Comprado</TableHead>
            <TableHead className="text-right">Vendido</TableHead>
            <TableHead className="text-right">Rendimentos</TableHead>
            <TableHead className="text-right">Lucro/Prejuízo</TableHead>
            {!readOnly && <TableHead className="w-28" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredInvestments.map(inv => {
            const isExpanded = expandedId === inv.id;
            const invEntries = getEntriesForInvestment(inv.id);
            const pnl = inv.realized_pnl;
            return (
              <>
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <TableCell>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="font-medium">{inv.name}</TableCell>
                  <TableCell><Badge variant="secondary">{getInvestmentTypeLabel(inv.type)}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(inv.total_invested)}</TableCell>
                  <TableCell className="text-right">{fmt(inv.total_sold)}</TableCell>
                  <TableCell className="text-right">{fmt(inv.total_dividends)}</TableCell>
                  <TableCell className={`text-right font-semibold ${pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                  </TableCell>
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
                    <TableCell colSpan={2} className="text-sm pl-8">
                      <Badge variant={entryTypeBadgeVariant[entry.entry_type]} className="mr-2 text-xs">
                        {getEntryTypeLabel(entry.entry_type)}
                      </Badge>
                      {format(parseISO(entry.date), "dd MMM yyyy", { locale: ptBR })}
                      {entry.quantity != null && (
                        <span className="ml-2 text-muted-foreground">×{entry.quantity}</span>
                      )}
                      {entry.notes && <span className="ml-2 italic text-muted-foreground">— {entry.notes}</span>}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${entry.entry_type === "buy" ? "" : entry.entry_type === "sell" ? "text-red-600" : "text-amber-600"}`}>
                      {entry.entry_type !== "buy" && "+"}{fmt(entry.amount)}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    {!readOnly && (
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <EntryFormDialog investmentId={inv.id} investmentName={inv.name} editEntry={entry} trigger={<Button size="icon" variant="ghost"><Pencil className="h-3 w-3" /></Button>} />
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDelete({ type: "entry", id: entry.id, name: `${getEntryTypeLabel(entry.entry_type)} de ${fmt(entry.amount)}` })}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {isExpanded && invEntries.length === 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={readOnly ? 7 : 8} className="text-center text-sm text-muted-foreground py-3">
                      Nenhum lançamento registrado
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      {/* Confirm single delete */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{confirmDelete?.name}</strong>?
            {confirmDelete?.type === "inv" && " Todos os lançamentos associados também serão removidos."}
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(v) => { setBulkDeleteOpen(v); if (!v) { setSelectedEntryIds(new Set()); setBulkCategory(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Excluir lançamentos em massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Selecione a categoria para filtrar os lançamentos:</p>
              <Select value={bulkCategory} onValueChange={(v) => { setBulkCategory(v); setSelectedEntryIds(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkCategory && entriesForCategory.length > 0 && (
              <>
                <div className="flex items-center gap-2 border-b pb-2">
                  <Checkbox
                    checked={selectedEntryIds.size === entriesForCategory.length && entriesForCategory.length > 0}
                    onCheckedChange={toggleAllEntries}
                  />
                  <span className="text-sm font-medium">Selecionar todos ({entriesForCategory.length})</span>
                </div>
                <div className="max-h-60 overflow-auto space-y-1">
                  {entriesForCategory.map(entry => {
                    const inv = investments.find(i => i.id === entry.investment_id);
                    return (
                      <div key={entry.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 text-sm">
                        <Checkbox
                          checked={selectedEntryIds.has(entry.id)}
                          onCheckedChange={() => toggleEntrySelection(entry.id)}
                        />
                        <span className="flex-1">{inv?.name}</span>
                        <Badge variant={entryTypeBadgeVariant[entry.entry_type]} className="text-xs">
                          {getEntryTypeLabel(entry.entry_type)}
                        </Badge>
                        {entry.quantity != null && <span className="text-muted-foreground">×{entry.quantity}</span>}
                        <span className="font-mono">{fmt(entry.amount)}</span>
                        <span className="text-muted-foreground">{format(parseISO(entry.date), "dd/MM/yy")}</span>
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="destructive"
                  disabled={selectedEntryIds.size === 0 || bulkDeleting}
                  onClick={handleBulkDelete}
                  className="w-full"
                >
                  {bulkDeleting ? "Excluindo..." : `Excluir ${selectedEntryIds.size} lançamentos`}
                </Button>
              </>
            )}

            {bulkCategory && entriesForCategory.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum lançamento encontrado para esta categoria.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
