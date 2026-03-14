import { useInvestments } from "@/contexts/InvestmentsContext";
import { INVESTMENT_TYPES } from "@/types/investments";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";

export function InvestmentFilters() {
  const { filters, setFilters } = useInvestments();

  const toggleType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type) ? prev.types.filter(t => t !== type) : [...prev.types, type],
    }));
  };

  const hasFilters = filters.types.length > 0 || filters.search;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar investimento..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-9"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ types: [], search: "", dateRange: null })}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {INVESTMENT_TYPES.map(t => (
          <Badge
            key={t.value}
            variant={filters.types.includes(t.value) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleType(t.value)}
          >
            {t.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
