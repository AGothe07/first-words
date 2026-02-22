import { useState } from "react";
import { useAssets } from "@/contexts/AssetsContext";
import { Asset } from "@/types/assets";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetForm } from "./AssetForm";
import { Pencil, Trash2, Search, ArrowUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";

type SortKey = "date" | "value" | "category";

export function AssetTable() {
  const { filteredAssets, deleteAsset } = useAssets();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filtered = filteredAssets
    .filter(a => {
      const q = search.toLowerCase();
      return !q || a.category.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "value") cmp = a.value - b.value;
      else cmp = a.category.localeCompare(b.category);
      return sortAsc ? cmp : -cmp;
    });

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
          <Input placeholder="Buscar categoria..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
      </div>

      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader k="date">Data</SortHeader>
              <SortHeader k="category">Categoria</SortHeader>
              <SortHeader k="value">Valor</SortHeader>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{format(parseISO(a.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-xs font-medium">{a.category}</TableCell>
                  <TableCell className="text-xs font-semibold">{fmt(a.value)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(a)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAsset(a.id)}>
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

      {editing && <AssetForm editAsset={editing} onClose={() => setEditing(null)} />}

      <p className="text-xs text-muted-foreground mt-2">{filtered.length} registro(s)</p>
    </div>
  );
}
