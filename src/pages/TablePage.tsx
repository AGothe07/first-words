import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionForm } from "@/components/transactions/TransactionForm";

export default function TablePage() {
  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tabela Detalhada</h1>
          <p className="text-sm text-muted-foreground">Todos os lançamentos com filtros e exportação</p>
        </div>
        <TransactionForm />
      </div>
      <GlobalFilters />
      <TransactionTable />
    </AppLayout>
  );
}
