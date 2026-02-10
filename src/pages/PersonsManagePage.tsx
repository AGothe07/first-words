import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useThrottle } from "@/hooks/useDebounce";

export default function PersonsManagePage() {
  const { persons, addPerson, updatePerson, deletePerson } = useFinance();
  const [newName, setNewName] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const throttledAdd = useThrottle(async () => {
    if (!newName.trim()) { toast.error("Nome obrigatório"); return; }
    await addPerson(newName);
    setNewName("");
    setOpenAdd(false);
  }, 1000);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as pessoas vinculadas aos lançamentos</p>
        </div>
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova Pessoa</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Nova Pessoa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: João" />
              </div>
              <Button onClick={throttledAdd} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {persons.length === 0 ? (
          <Card className="col-span-full border-border"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma pessoa cadastrada</CardContent></Card>
        ) : persons.map(p => (
          <Card key={p.id} className="border-border shadow-sm">
            <CardContent className="p-3 flex items-center justify-between">
              {editingId === p.id ? (
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-sm w-32"
                  onBlur={() => { updatePerson(p.id, editName, p.is_active); setEditingId(null); }}
                  onKeyDown={e => { if (e.key === "Enter") { updatePerson(p.id, editName, p.is_active); setEditingId(null); } }}
                  autoFocus />
              ) : (
                <span className={`text-sm font-medium ${!p.is_active ? "text-muted-foreground line-through" : ""}`}>{p.name}</span>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={p.is_active} onCheckedChange={v => updatePerson(p.id, p.name, v)} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(p.id); setEditName(p.name); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePerson(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
