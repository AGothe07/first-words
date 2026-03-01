import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { Shield, Clock, LogIn } from "lucide-react";

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

export function SecuritySection({ preferences, onUpdate }: Props) {
  const { user } = useAuth();
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setLastLogin(user.last_sign_in_at || null);
    }
  }, [user]);

  if (!preferences) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Tempo máximo de sessão</Label>
            <Select value={String(preferences.max_session_hours)} onValueChange={v => onUpdate({ max_session_hours: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hora</SelectItem>
                <SelectItem value="4">4 horas</SelectItem>
                <SelectItem value="8">8 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
                <SelectItem value="720">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {lastLogin && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <LogIn className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Último login</p>
                <p className="text-sm">{new Date(lastLogin).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg border border-dashed">
            <p className="text-xs text-muted-foreground">
              Autenticação em duas etapas (2FA) estará disponível em breve.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
