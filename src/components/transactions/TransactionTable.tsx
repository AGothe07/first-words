import { useState, useMemo } from "react";
import { useFinance } from "@/contexts/FinanceContext";
import { Transaction } from "@/types/finance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TransactionForm } from "./TransactionForm";
import { Pencil, Trash2, Download, Search, ArrowUpDown, Filter, X, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useThrottle } from "@/hooks/useDebounce";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type SortKey = "date" | "amount" | "person_name" | "category_name";

export function TransactionTable() {
  const { filteredTransactions, deleteTransaction, bulkDeleteTransactions, categories, subcategories, persons } = useFinance();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Bulk delete state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkType, setBulkType] = useState<string>("all");
  const [bulkPerson, setBulkPerson] = useState<string>("all");
  const [bulkCategory, setBulkCategory] = useState<string>("all");
  const [bulkSubcategory, setBulkSubcategory] = useState<string>("all");
  const [bulkDateFrom, setBulkDateFrom] = useState("");
  const [bulkDateTo, setBulkDateTo] = useState("");
  const [bulkAmountMin, setBulkAmountMin] = useState("");
  const [bulkAmountMax, setBulkAmountMax] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const throttledDelete = useThrottle(async (id: string) => {
    await deleteTransaction(id);
  }, 500);

  const filtered = filteredTransactions
    .filter(t => {
      const q = search.toLowerCase();
      return !q || (t.person_name || "").toLowerCase().includes(q) || (t.category_name || "").toLowerCase().includes(q) ||
        (t.subcategory_name || "").toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "person_name") cmp = (a.person_name || "").localeCompare(b.person_name || "");
      else cmp = (a.category_name || "").localeCompare(b.category_name || "");
      return sortAsc ? cmp : -cmp;
    });

  // Bulk delete: filter from ALL filtered transactions (respecting global filters)
  const bulkTargets = useMemo(() => {
    return filteredTransactions.filter(t => {
      if (bulkType !== "all" && t.type !== bulkType) return false;
      if (bulkPerson !== "all" && t.person_id !== bulkPerson) return false;
      if (bulkCategory !== "all" && t.category_id !== bulkCategory) return false;
      if (bulkSubcategory !== "all" && t.subcategory_id !== bulkSubcategory) return false;
      if (bulkDateFrom && t.date < bulkDateFrom) return false;
      if (bulkDateTo && t.date > bulkDateTo) return false;
      if (bulkAmountMin && t.amount < parseFloat(bulkAmountMin)) return false;
      if (bulkAmountMax && t.amount > parseFloat(bulkAmountMax)) return false;
      return true;
    });
  }, [filteredTransactions, bulkType, bulkPerson, bulkCategory, bulkSubcategory, bulkDateFrom, bulkDateTo, bulkAmountMin, bulkAmountMax]);

  const handleBulkDelete = async () => {
    if (bulkTargets.length === 0 || bulkConfirmText !== "DELETAR") return;
    setBulkDeleting(true);
    await bulkDeleteTransactions(bulkTargets.map(t => t.id));
    setBulkDeleting(false);
    setBulkOpen(false);
    resetBulkFilters();
  };

  const resetBulkFilters = () => {
    setBulkType("all");
    setBulkPerson("all");
    setBulkCategory("all");
    setBulkSubcategory("all");
    setBulkDateFrom("");
    setBulkDateTo("");
    setBulkAmountMin("");
    setBulkAmountMax("");
    setBulkConfirmText("");
  };

  const exportCSV = () => {
    const headers = "Data,Tipo,Valor,Pessoa,Categoria,Subcategoria,Observações\n";
    const rows = filtered.map(t =>
      `${t.date},${t.type === "expense" ? "Gasto" : "Receita"},${t.amount},${t.person_name},${t.category_name},${t.subcategory_name || ""},"${t.notes || ""}"`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financas_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Subcategories filtered by selected bulk category
  const bulkSubcategoryOptions = useMemo(() => {
    if (bulkCategory === "all") return subcategories;
    return subcategories.filter(s => s.category_id === bulkCategory);
  }, [bulkCategory, subcategories]);

  const SortHeader = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => handleSort(k)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>

        <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) resetBulkFilters(); }}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1">
              <Trash2 className="h-4 w-4" /> Exclusão em Massa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Exclusão em Massa
              </DialogTitle>
              <DialogDescription>
                Use os filtros abaixo para selecionar quais lançamentos deseja excluir. Esta ação é irreversível.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={bulkType} onValueChange={setBulkType}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="expense">Gasto</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Pessoa</Label>
                  <Select value={bulkPerson} onValueChange={setBulkPerson}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Select value={bulkCategory} onValueChange={(v) => { setBulkCategory(v); setBulkSubcategory("all"); }}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Subcategoria</Label>
                  <Select value={bulkSubcategory} onValueChange={setBulkSubcategory}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {bulkSubcategoryOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data de</Label>
                  <Input type="date" value={bulkDateFrom} onChange={e => setBulkDateFrom(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Data até</Label>
                  <Input type="date" value={bulkDateTo} onChange={e => setBulkDateTo(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor mínimo</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={bulkAmountMin} onChange={e => setBulkAmountMin(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Valor máximo</Label>
                  <Input type="number" step="0.01" placeholder="999999" value={bulkAmountMax} onChange={e => setBulkAmountMax(e.target.value)} className="h-8 text-xs mt-1" />
                </div>
              </div>

              {/* Preview */}
              <div className={`p-3 rounded-md border text-sm ${bulkTargets.length > 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted"}`}>
                <p className="font-semibold">
                  {bulkTargets.length} lançamento(s) selecionado(s)
                </p>
                {bulkTargets.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {fmt(bulkTargets.reduce((sum, t) => sum + t.amount, 0))}
                  </p>
                )}
                {bulkTargets.length > 0 && bulkTargets.length <= 5 && (
                  <div className="mt-2 space-y-1">
                    {bulkTargets.map(t => (
                      <div key={t.id} className="text-xs text-muted-foreground">
                        {format(parseISO(t.date), "dd/MM/yy")} · {fmt(t.amount)} · {t.category_name} · {t.person_name}
                      </div>
                    ))}
                  </div>
                )}
                {bulkTargets.length > 5 && (
                  <div className="mt-2 space-y-1">
                    {bulkTargets.slice(0, 3).map(t => (
                      <div key={t.id} className="text-xs text-muted-foreground">
                        {format(parseISO(t.date), "dd/MM/yy")} · {fmt(t.amount)} · {t.category_name} · {t.person_name}
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground italic">... e mais {bulkTargets.length - 3}</div>
                  </div>
                )}
              </div>

              {/* Confirmation */}
              {bulkTargets.length > 0 && (
                <div>
                  <Label className="text-xs">Digite <span className="font-bold text-destructive">DELETAR</span> para confirmar:</Label>
                  <Input
                    value={bulkConfirmText}
                    onChange={e => setBulkConfirmText(e.target.value)}
                    placeholder="DELETAR"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setBulkOpen(false); resetBulkFilters(); }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={bulkTargets.length === 0 || bulkConfirmText !== "DELETAR" || bulkDeleting}
                onClick={handleBulkDelete}
              >
                {bulkDeleting ? "Excluindo..." : `Excluir ${bulkTargets.length} lançamento(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader k="date">Data</SortHeader>
              <TableHead>Tipo</TableHead>
              <SortHeader k="amount">Valor</SortHeader>
              <SortHeader k="person_name">Pessoa</SortHeader>
              <SortHeader k="category_name">Categoria</SortHeader>
              <TableHead>Sub</TableHead>
              <TableHead>Obs</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{format(parseISO(t.date), "dd/MM/yy")}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === "income" ? "default" : "destructive"} className="text-[10px]">
                      {t.type === "income" ? "Receita" : "Gasto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{fmt(t.amount)}</TableCell>
                  <TableCell className="text-xs">{t.person_name}</TableCell>
                  <TableCell className="text-xs">{t.category_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.subcategory_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{t.notes}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => throttledDelete(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editing && <TransactionForm editTransaction={editing} onClose={() => setEditing(null)} />}

      <p className="text-xs text-muted-foreground mt-2">{filtered.length} lançamento(s)</p>
    </div>
  );
}
