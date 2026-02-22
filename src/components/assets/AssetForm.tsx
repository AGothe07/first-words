import { useState } from "react";
import { useAssets } from "@/contexts/AssetsContext";
import { Asset } from "@/types/assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  editAsset?: Asset;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export function AssetForm({ editAsset, onClose, trigger }: Props) {
  const { addAsset, updateAsset, assetCategories } = useAssets();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState(editAsset?.category || "");
  const [date, setDate] = useState(editAsset?.date || new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState(editAsset?.value?.toString() || "");

  const activeCategories = assetCategories.filter(c => c.is_active);

  const reset = () => {
    setCategory(""); setDate(new Date().toISOString().slice(0, 10)); setValue("");
  };

  const handleSubmit = async () => {
    if (!category || !date || !value) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (parseFloat(value) < 0) {
      toast.error("Valor deve ser positivo");
      return;
    }
    setSaving(true);
    // Find category name from ID
    const cat = assetCategories.find(c => c.id === category);
    const categoryName = cat ? cat.name : category;
    const data = { category: categoryName.toUpperCase(), date, value: parseFloat(value) };

    if (editAsset) {
      await updateAsset({ ...editAsset, ...data });
    } else {
      await addAsset(data);
    }
    setSaving(false);
    reset();
    setOpen(false);
    onClose?.();
  };

  const noCategories = activeCategories.length === 0;

  // For edit, find category ID by name
  const selectedCategoryId = editAsset
    ? assetCategories.find(c => c.name.toUpperCase() === editAsset.category.toUpperCase())?.id || ""
    : category;

  return (
    <Dialog open={editAsset ? true : open} onOpenChange={v => { if (!editAsset) setOpen(v); else if (!v) onClose?.(); }}>
      {!editAsset && (
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Novo Registro
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editAsset ? "Editar" : "Novo"} Patrimônio</DialogTitle>
        </DialogHeader>

        {noCategories && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            ⚠️ Cadastre ao menos uma categoria de Patrimônio em Categorias antes de lançar.
          </div>
        )}

        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Categoria *</Label>
            <Select value={editAsset ? selectedCategoryId : category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
              <SelectContent>
                {activeCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data de referência *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={value} onChange={e => setValue(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={saving || noCategories}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editAsset ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
