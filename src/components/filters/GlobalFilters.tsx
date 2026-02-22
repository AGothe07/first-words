import { useFinance } from "@/contexts/FinanceContext";
import { useDimensions } from "@/contexts/DimensionsContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Filter } from "lucide-react";

export function GlobalFilters() {
  const { filters, setFilters, persons, categories } = useFinance();
  const { isDimensionActive, paymentMethods, accounts, projects } = useDimensions();

  const presets = [
    { value: "7d", label: "Últimos 7 dias" },
    { value: "30d", label: "Últimos 30 dias" },
    { value: "month", label: "Mês atual" },
    { value: "year", label: "Ano atual" },
    { value: "upto_month", label: "Até o mês atual" },
    { value: "all", label: "Todo período" },
  ];

  const activeFiltersCount = [
    filters.persons.length > 0,
    filters.categories.length > 0,
    filters.type !== "all",
    filters.paymentMethods.length > 0,
    filters.accounts.length > 0,
    filters.projects.length > 0,
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(prev => ({
    ...prev,
    persons: [],
    categories: [],
    subcategories: [],
    type: "all",
    paymentMethods: [],
    accounts: [],
    projects: [],
  }));

  const activePersons = persons.filter(p => p.is_active);
  const activeCategories = categories.filter(c => c.is_active);
  const activePMs = paymentMethods.filter(p => p.is_active);
  const activeAccounts = accounts.filter(a => a.is_active);
  const activeProjects = projects.filter(p => p.is_active);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-xl bg-muted/50 border border-border">
      <Filter className="h-4 w-4 text-muted-foreground" />

      <Select value={filters.preset} onValueChange={v => setFilters(prev => ({ ...prev, preset: v }))}>
        <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {presets.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.type} onValueChange={v => setFilters(prev => ({ ...prev, type: v as any }))}>
        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="expense">Gastos</SelectItem>
          <SelectItem value="income">Receitas</SelectItem>
        </SelectContent>
      </Select>

      {activePersons.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Pessoa {filters.persons.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{filters.persons.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            {activePersons.map(p => (
              <label key={p.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={filters.persons.includes(p.id)}
                  onCheckedChange={checked => {
                    setFilters(prev => ({
                      ...prev,
                      persons: checked ? [...prev.persons, p.id] : prev.persons.filter(x => x !== p.id)
                    }));
                  }}
                />
                {p.name}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {activeCategories.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Categoria {filters.categories.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{filters.categories.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 max-h-64 overflow-auto">
            {activeCategories.map(c => (
              <label key={c.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={filters.categories.includes(c.id)}
                  onCheckedChange={checked => {
                    setFilters(prev => ({
                      ...prev,
                      categories: checked ? [...prev.categories, c.id] : prev.categories.filter(x => x !== c.id)
                    }));
                  }}
                />
                {c.name}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {isDimensionActive("payment_method") && activePMs.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Forma Pgto {filters.paymentMethods.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{filters.paymentMethods.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 max-h-64 overflow-auto">
            {activePMs.map(p => (
              <label key={p.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={filters.paymentMethods.includes(p.id)}
                  onCheckedChange={checked => {
                    setFilters(prev => ({
                      ...prev,
                      paymentMethods: checked ? [...prev.paymentMethods, p.id] : prev.paymentMethods.filter(x => x !== p.id)
                    }));
                  }}
                />
                {p.name}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {isDimensionActive("account") && activeAccounts.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Conta {filters.accounts.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{filters.accounts.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 max-h-64 overflow-auto">
            {activeAccounts.map(a => (
              <label key={a.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={filters.accounts.includes(a.id)}
                  onCheckedChange={checked => {
                    setFilters(prev => ({
                      ...prev,
                      accounts: checked ? [...prev.accounts, a.id] : prev.accounts.filter(x => x !== a.id)
                    }));
                  }}
                />
                {a.name}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {isDimensionActive("project") && activeProjects.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Projeto {filters.projects.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{filters.projects.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 max-h-64 overflow-auto">
            {activeProjects.map(p => (
              <label key={p.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={filters.projects.includes(p.id)}
                  onCheckedChange={checked => {
                    setFilters(prev => ({
                      ...prev,
                      projects: checked ? [...prev.projects, p.id] : prev.projects.filter(x => x !== p.id)
                    }));
                  }}
                />
                {p.name}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
          <X className="h-3 w-3 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}
