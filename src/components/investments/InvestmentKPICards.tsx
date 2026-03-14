import { useInvestments } from "@/contexts/InvestmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Layers, BarChart3, Calendar } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentKPICards() {
  const { filteredInvestments, entries } = useInvestments();

  const totalInvested = filteredInvestments.reduce((s, i) => s + i.total_invested, 0);
  const totalAssets = filteredInvestments.length;
  const totalEntries = filteredInvestments.reduce((s, i) => s + i.entry_count, 0);
  const typesCount = new Set(filteredInvestments.map(i => i.type)).size;

  const cards = [
    { label: "Total Investido", value: fmt(totalInvested), icon: TrendingUp, color: "text-emerald-500" },
    { label: "Ativos", value: String(totalAssets), icon: Layers, color: "text-blue-500" },
    { label: "Aportes", value: String(totalEntries), icon: Calendar, color: "text-amber-500" },
    { label: "Tipos", value: String(typesCount), icon: BarChart3, color: "text-purple-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
