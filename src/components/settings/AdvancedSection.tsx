import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { Download, Upload, RotateCcw, Trash, Settings2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

export function AdvancedSection({ preferences, onUpdate }: Props) {
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  const resetPreferences = async () => {
    setResetting(true);
    const defaults: Partial<UserPreferences> = {
      default_currency: "BRL",
      date_format: "DD/MM/YYYY",
      financial_month_start: 1,
      default_goal_unit: "R$",
      goal_progress_mode: "total",
      default_agenda_view: "month",
      business_hours_start: "08:00",
      business_hours_end: "18:00",
      default_event_duration: 60,
      default_event_notify: true,
      theme: "light",
      primary_color: "#0D9488",
      font_size: "medium",
      layout_density: "comfortable",
      max_session_hours: 24,
      notifications_enabled: true,
      birthday_send_time: "09:00",
      events_send_time: "09:00",
    };
    await onUpdate(defaults);
    setResetting(false);
  };

  const clearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast({ title: "Cache limpo!", description: "O cache local foi limpo com sucesso." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" /> Avançado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2 justify-start" onClick={() => navigate("/import")}>
              <Upload className="h-4 w-4" /> Importar Dados
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => {
              toast({ title: "Exportação", description: "Use a tabela de lançamentos para exportar dados em CSV/Excel." });
              navigate("/transactions");
            }}>
              <Download className="h-4 w-4" /> Exportar Dados
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 space-y-3">
          <Button variant="outline" className="gap-2 w-full justify-start" onClick={resetPreferences} disabled={resetting}>
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Resetar Preferências para Padrão
          </Button>
          <Button variant="outline" className="gap-2 w-full justify-start text-destructive hover:text-destructive" onClick={clearCache}>
            <Trash className="h-4 w-4" /> Limpar Cache do Sistema
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
