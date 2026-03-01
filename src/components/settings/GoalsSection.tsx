import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { Target } from "lucide-react";

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

export function GoalsSection({ preferences, onUpdate }: Props) {
  if (!preferences) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Preferências de Metas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Unidade padrão</Label>
          <Select value={preferences.default_goal_unit} onValueChange={v => onUpdate({ default_goal_unit: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="R$">R$ (Reais)</SelectItem>
              <SelectItem value="USD">USD (Dólares)</SelectItem>
              <SelectItem value="%">% (Percentual)</SelectItem>
              <SelectItem value="kg">kg (Quilogramas)</SelectItem>
              <SelectItem value="un">un (Unidades)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Exibição do progresso</Label>
          <Select value={preferences.goal_progress_mode} onValueChange={v => onUpdate({ goal_progress_mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Valor total acumulado</SelectItem>
              <SelectItem value="remaining">Valor restante para a meta</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Define se a barra de progresso mostra o total acumulado ou quanto falta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
