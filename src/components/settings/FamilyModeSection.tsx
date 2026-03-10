import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import type { UserPreferences } from "@/hooks/useUserPreferences";

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

export function FamilyModeSection({ preferences, onUpdate }: Props) {
  if (!preferences) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Modo Família
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Ativar Modo Família</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando ativado, a seção "Família" aparecerá no menu lateral. Você poderá criar ou participar de uma família compartilhada.
            </p>
          </div>
          <Switch
            checked={preferences.family_mode_enabled}
            onCheckedChange={(v) => onUpdate({ family_mode_enabled: v })}
          />
        </div>
        {preferences.family_mode_enabled && (
          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            ✅ Modo Família ativado. Acesse a seção <strong>Família</strong> no menu lateral para criar ou gerenciar sua família.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
