import { useState, useEffect } from "react";
import { useAssets } from "@/contexts/AssetsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function QuickAssetUpdate() {
  const { assets, assetCategories, addAsset, updateAsset, refreshData } = useAssets();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const today = new Date();
  const currentMonth = format(today, "yyyy-MM");
  const currentMonthLabel = format(today, "MMMM/yyyy", { locale: ptBR });

  const allCategories = assetCategories.length > 0
    ? assetCategories.map(c => c.name)
    : [...new Set(assets.map(a => a.category))];

  // Pre-fill with latest values when opening
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    for (const cat of allCategories) {
      const latest = [...assets].filter(a => a.category === cat).sort((a, b) => b.date.localeCompare(a.date))[0];
      initial[cat] = latest ? String(latest.value) : "";
    }
    setValues(initial);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    const dateStr = format(today, "yyyy-MM-dd");
    for (const cat of allCategories) {
      const val = values[cat];
      if (!val) continue;
      const existing = assets.find(a => a.category === cat && a.date.startsWith(currentMonth));
      if (existing) {
        if (Number(val) !== existing.value || existing.date !== dateStr) {
          await updateAsset({ ...existing, value: Number(val), date: dateStr });
        }
      } else {
        await addAsset({ category: cat, date: dateStr, value: Number(val) });
      }
    }
    await refreshData();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar Mês
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Patrimônio — {currentMonthLabel}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Atualize os valores de todas as categorias de uma vez.</p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {allCategories.map(cat => {
            const existing = assets.find(a => a.category === cat && a.date.startsWith(currentMonth));
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm min-w-[120px] truncate">{cat}</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    className="h-8 text-sm pl-9"
                    value={values[cat] || ""}
                    onChange={e => setValues(v => ({ ...v, [cat]: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                {existing && <span className="text-[10px] text-muted-foreground whitespace-nowrap">✓ mês</span>}
              </div>
            );
          })}
        </div>
        <Button className="w-full" size="sm" onClick={handleSubmit}>Salvar Tudo</Button>
      </DialogContent>
    </Dialog>
  );
}
