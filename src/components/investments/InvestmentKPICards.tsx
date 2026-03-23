import { useInvestments } from "@/contexts/InvestmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Layers, DollarSign, BarChart3, Percent } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentKPICards() {
  const { filteredInvestments } = useInvestments();

  const totalInvested = filteredInvestments.reduce((s, i) => s + i.total_invested, 0);
  const totalSold = filteredInvestments.reduce((s, i) => s + i.total_sold, 0);
  const totalDividends = filteredInvestments.reduce((s, i) => s + i.total_dividends, 0);
  const netPosition = filteredInvestments.reduce((s, i) => s + i.net_position, 0);
  const realizedPnl = totalSold + totalDividends - totalInvested;
  const returnPct = totalInvested > 0 ? ((totalSold + totalDividends - totalInvested) / totalInvested) * 100 : 0;
  const totalAssets = filteredInvestments.length;

  const cards = [
    { label: "Total Comprado", value: fmt(totalInvested), icon: TrendingUp, color: "text-emerald-500" },
    { label: "Total Vendido", value: fmt(totalSold), icon: TrendingDown, color: "text-red-500" },
    { label: "Rendimentos", value: fmt(totalDividends), icon: DollarSign, color: "text-amber-500" },
    { label: "Posição Líquida", value: fmt(netPosition), icon: Layers, color: "text-blue-500" },
    { label: "Lucro/Prejuízo", value: fmt(realizedPnl), icon: BarChart3, color: realizedPnl >= 0 ? "text-emerald-500" : "text-red-500" },
    { label: "Retorno %", value: `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%`, icon: Percent, color: returnPct >= 0 ? "text-emerald-500" : "text-red-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-lg font-bold mt-1">{c.value}</p>
              </div>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
