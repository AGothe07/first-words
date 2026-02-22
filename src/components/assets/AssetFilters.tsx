import { useAssets } from "@/contexts/AssetsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const PRESETS = [
  { label: "6 meses", value: "6m" },
  { label: "Este ano", value: "year" },
  { label: "Tudo", value: "all" },
  { label: "Personalizado", value: "custom" },
];

export function AssetFilters() {
  const { filters, setFilters, assetCategories } = useAssets();

  const activeCategories = assetCategories.filter(c => c.is_active);

  const toggleCategory = (catName: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(catName)
        ? prev.categories.filter(c => c !== catName)
        : [...prev.categories, catName],
    }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border bg-card">
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <Button
            key={p.value}
            variant={filters.preset === p.value ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setFilters(prev => ({ ...prev, preset: p.value }))}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {filters.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-7 text-xs w-[130px]"
            value={filters.dateRange?.from || ""}
            onChange={e => setFilters(prev => ({
              ...prev,
              dateRange: { from: e.target.value, to: prev.dateRange?.to || "" },
            }))}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="h-7 text-xs w-[130px]"
            value={filters.dateRange?.to || ""}
            onChange={e => setFilters(prev => ({
              ...prev,
              dateRange: { from: prev.dateRange?.from || "", to: e.target.value },
            }))}
          />
        </div>
      )}

      {activeCategories.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-2">
          {activeCategories.map(cat => (
            <Badge
              key={cat.id}
              variant={filters.categories.includes(cat.name) ? "default" : "outline"}
              className="text-[10px] cursor-pointer"
              onClick={() => toggleCategory(cat.name)}
            >
              {cat.name}
              {filters.categories.includes(cat.name) && <X className="h-2.5 w-2.5 ml-1" />}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
