import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetForm } from "@/components/assets/AssetForm";
import { AssetTable } from "@/components/assets/AssetTable";
import { AssetFilters } from "@/components/assets/AssetFilters";
import { AssetKPICards } from "@/components/assets/AssetKPICards";
import { AssetTimelineChart } from "@/components/assets/AssetTimelineChart";
import { AssetDistributionChart } from "@/components/assets/AssetDistributionChart";
import { AssetGrowthChart } from "@/components/assets/AssetGrowthChart";

export default function AssetsPage() {
  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Patrimônio</h1>
          <p className="text-sm text-muted-foreground">Registre e acompanhe a evolução do seu patrimônio</p>
        </div>
        <AssetForm />
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="records">Registros</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <AssetFilters />
          <AssetKPICards />
          <div className="mb-4">
            <AssetTimelineChart />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AssetDistributionChart />
            <AssetGrowthChart />
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <AssetFilters />
          <AssetTable />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
