import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { DollarSign } from "lucide-react";

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

export function FinancialSection({ preferences, onUpdate }: Props) {
  if (!preferences) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Preferências Financeiras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Moeda padrão</Label>
            <Select value={preferences.default_currency} onValueChange={v => onUpdate({ default_currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL - Real Brasileiro</SelectItem>
                <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - Libra Esterlina</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Formato de data</Label>
            <Select value={preferences.date_format} onValueChange={v => onUpdate({ date_format: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Primeiro dia do mês financeiro</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={preferences.financial_month_start}
              onChange={e => onUpdate({ financial_month_start: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">Define quando seu mês financeiro começa (1-28)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Para gerenciar categorias, subcategorias e pessoas, acesse as páginas de cadastro no menu lateral (Finanças → Cadastros).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
