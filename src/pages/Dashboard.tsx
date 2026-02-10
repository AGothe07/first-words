import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { KPICards } from "@/components/dashboard/KPICards";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { SpendingTimelineChart } from "@/components/dashboard/SpendingTimelineChart";
import { PersonChart } from "@/components/dashboard/PersonChart";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { CategoryRankingChart } from "@/components/dashboard/CategoryRankingChart";
import { SubcategoryChart } from "@/components/dashboard/SubcategoryChart";
import { CumulativeBalanceChart } from "@/components/dashboard/CumulativeBalanceChart";
import { PersonTimelineChart } from "@/components/dashboard/PersonTimelineChart";
import { WeekdayChart } from "@/components/dashboard/WeekdayChart";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { useFinance } from "@/contexts/FinanceContext";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

function ActiveSelectionBanner() {
  const { chartSelection, clearChartSelection, toggleChartSelection } = useFinance();
  if (!chartSelection.type || chartSelection.ids.length === 0) return null;

  const typeLabels: Record<string, string> = {
    category: "Categoria",
    person: "Pessoa",
    type: "Tipo",
    subcategory: "Subcategoria",
  };

  return (
    <div className="flex items-center gap-2 mb-4 p-2 px-3 rounded-lg bg-primary/10 border border-primary/20 flex-wrap">
      <span className="text-xs text-muted-foreground">Filtros ativos ({typeLabels[chartSelection.type]}):</span>
      {chartSelection.ids.map((id, i) => (
        <Badge key={id} variant="secondary" className="text-xs gap-1">
          {chartSelection.labels[i]}
          <button onClick={() => toggleChartSelection(chartSelection.type!, id, chartSelection.labels[i])} className="ml-1 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <button onClick={clearChartSelection} className="text-xs text-muted-foreground hover:text-destructive ml-2">
        Limpar tudo
      </button>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visão geral completa das suas finanças</p>
        </div>
        <TransactionForm />
      </div>

      <GlobalFilters />
      <ActiveSelectionBanner />
      <KPICards />

      {/* Timeline principal */}
      <div className="mb-4">
        <SpendingTimelineChart />
      </div>

      {/* Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <CategoryChart />
        <CategoryRankingChart />
      </div>

      {/* Subcategorias */}
      <div className="mb-4">
        <SubcategoryChart />
      </div>

      {/* Pessoas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PersonChart />
        <PersonTimelineChart />
      </div>

      {/* Saldo + Dia da semana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <CumulativeBalanceChart />
        <WeekdayChart />
      </div>

      <div className="mb-4">
        <InsightsPanel />
      </div>
    </AppLayout>
  );
}
