import { useFinance } from "@/contexts/FinanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";

export function TransactionListCard() {
  const { crossFilteredTransactions } = useFinance();

  const sorted = [...crossFilteredTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const total = sorted.length;
  const totalIncome = sorted.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = sorted.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Transações
            <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
              {total}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <span className="text-emerald-500">
              +{totalIncome.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            <span className="text-red-400">
              -{totalExpense.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <ScrollArea className="h-[380px] px-4 pb-3">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma transação encontrada para os filtros selecionados.
            </p>
          ) : (
            <div className="space-y-0.5">
              {sorted.map((t) => {
                const isIncome = t.type === "income";
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
                  >
                    <div className={`shrink-0 rounded-full p-1 ${isIncome ? "bg-emerald-500/10" : "bg-red-400/10"}`}>
                      {isIncome ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ArrowDownLeft className="h-3 w-3 text-red-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">
                          {t.category_name}
                        </span>
                        {t.subcategory_name && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            / {t.subcategory_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="truncate">{t.person_name}</span>
                        <span>·</span>
                        <span className="shrink-0">
                          {format(parseISO(t.date), "dd MMM", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 text-xs font-semibold tabular-nums ${
                        isIncome ? "text-emerald-500" : "text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
