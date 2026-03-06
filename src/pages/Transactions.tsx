import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalFilters } from "@/components/filters/GlobalFilters";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { useReadOnly } from "@/hooks/useReadOnly";

export default function Transactions() {
  const { isReadOnly } = useReadOnly();

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Gerencie receitas e gastos</p>
        </div>
        {!isReadOnly && <TransactionForm />}
      </div>
      <GlobalFilters />
      <TransactionTable readOnly={isReadOnly} />
    </AppLayout>
  );
}
