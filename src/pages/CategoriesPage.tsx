import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useFinance } from "@/contexts/FinanceContext";
import { TransactionType } from "@/types/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ChevronRight, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { useThrottle } from "@/hooks/useDebounce";

export default function CategoriesPage() {
  const { categories, subcategories, addCategory, updateCategory, deleteCategory, addSubcategory, updateSubcategory, deleteSubcategory } = useFinance();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TransactionType>("expense");
  const [openAdd, setOpenAdd] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [filterType, setFilterType] = useState<TransactionType | "all">("all");

  const throttledAddCategory = useThrottle(async () => {
    if (!newName.trim()) { toast.error("Nome obrigatório"); return; }
    await addCategory(newName, newType);
    setNewName("");
    setOpenAdd(false);
  }, 1000);

  const throttledAddSub = useThrottle(async (catId: string) => {
    if (!newSubName.trim()) { toast.error("Nome obrigatório"); return; }
    await addSubcategory(catId, newSubName);
    setNewSubName("");
  }, 1000);

  const filtered = categories.filter(c => filterType === "all" || c.type === filterType);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">Gerencie categorias macro e subcategorias</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="expense">Gastos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Alimentação" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={newType} onValueChange={v => setNewType(v as TransactionType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Gasto</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={throttledAddCategory} className="w-full">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="border-border"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma categoria cadastrada</CardContent></Card>
        ) : filtered.map(cat => {
          const subs = subcategories.filter(s => s.category_id === cat.id);
          const isExpanded = expandedCat === cat.id;
          return (
            <Card key={cat.id} className="border-border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <button onClick={() => setExpandedCat(isExpanded ? null : cat.id)} className="p-1 hover:bg-muted rounded">
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    {editingCat === cat.id ? (
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-sm w-40"
                        onBlur={() => { updateCategory(cat.id, editName, cat.is_active); setEditingCat(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { updateCategory(cat.id, editName, cat.is_active); setEditingCat(null); } }}
                        autoFocus />
                    ) : (
                      <span className={`text-sm font-medium ${!cat.is_active ? "text-muted-foreground line-through" : ""}`}>{cat.name}</span>
                    )}
                    <Badge variant="outline" className="text-[10px]">{cat.type === "expense" ? "Gasto" : "Receita"}</Badge>
                    {subs.length > 0 && <Badge variant="secondary" className="text-[10px]">{subs.length} sub</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={cat.is_active} onCheckedChange={v => updateCategory(cat.id, cat.name, v)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCat(cat.id); setEditName(cat.name); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ml-8 mt-3 space-y-2">
                    {subs.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className={`text-xs ${!sub.is_active ? "text-muted-foreground line-through" : ""}`}>{sub.name}</span>
                        <div className="flex items-center gap-2">
                          <Switch checked={sub.is_active} onCheckedChange={v => updateSubcategory(sub.id, sub.name, v)} />
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteSubcategory(sub.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Nova subcategoria..." className="h-7 text-xs flex-1" />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => throttledAddSub(cat.id)}>
                        <FolderPlus className="h-3 w-3" /> Adicionar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
