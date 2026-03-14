import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvestmentFormDialog } from "@/components/investments/InvestmentFormDialog";
import { InvestmentTable } from "@/components/investments/InvestmentTable";
import { InvestmentFilters } from "@/components/investments/InvestmentFilters";
import { InvestmentKPICards } from "@/components/investments/InvestmentKPICards";
import { InvestmentDistributionChart } from "@/components/investments/InvestmentDistributionChart";
import { InvestmentTimelineChart } from "@/components/investments/InvestmentTimelineChart";
import { InvestmentRankingChart } from "@/components/investments/InvestmentRankingChart";
import { useReadOnly } from "@/hooks/useReadOnly";

export default function InvestmentsPage() {
  const { isReadOnly } = useReadOnly();

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">Controle de aportes e distribuição dos seus investimentos</p>
        </div>
        {!isReadOnly && <InvestmentFormDialog />}
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
            <InvestmentRankingChart />
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <InvestmentFilters />
          <InvestmentTable readOnly={isReadOnly} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
