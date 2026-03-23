import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvestmentFormDialog } from "@/components/investments/InvestmentFormDialog";
import { ImportInvestmentsDialog } from "@/components/investments/ImportInvestmentsDialog";
import { InvestmentTable } from "@/components/investments/InvestmentTable";
import { InvestmentFilters } from "@/components/investments/InvestmentFilters";
import { InvestmentKPICards } from "@/components/investments/InvestmentKPICards";
import { InvestmentDistributionChart } from "@/components/investments/InvestmentDistributionChart";
import { InvestmentTimelineChart } from "@/components/investments/InvestmentTimelineChart";
import { InvestmentRankingChart } from "@/components/investments/InvestmentRankingChart";
import { InvestmentPnLChart } from "@/components/investments/InvestmentPnLChart";
import { useReadOnly } from "@/hooks/useReadOnly";

export default function InvestmentsPage() {
  const { isReadOnly } = useReadOnly();

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">Controle de compras, vendas, rendimentos e performance dos seus investimentos</p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <ImportInvestmentsDialog />
            <InvestmentFormDialog />
          </div>
        )}
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="records">Investimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <InvestmentFilters />
          <InvestmentKPICards />
          <InvestmentTimelineChart />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InvestmentDistributionChart />
            <InvestmentPnLChart />
          </div>
          <InvestmentRankingChart />
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <InvestmentFilters />
          <InvestmentTable readOnly={isReadOnly} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
