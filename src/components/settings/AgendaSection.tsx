import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { CalendarDays } from "lucide-react";

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

export function AgendaSection({ preferences, onUpdate }: Props) {
  if (!preferences) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" /> Preferências da Agenda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Visualização padrão</Label>
          <Select value={preferences.default_agenda_view} onValueChange={v => onUpdate({ default_agenda_view: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="day">Diária</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Início do horário comercial</Label>
            <Input type="time" value={preferences.business_hours_start}
              onChange={e => onUpdate({ business_hours_start: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Fim do horário comercial</Label>
            <Input type="time" value={preferences.business_hours_end}
              onChange={e => onUpdate({ business_hours_end: e.target.value })} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Duração padrão de eventos (minutos)</Label>
          <Select value={String(preferences.default_event_duration)} onValueChange={v => onUpdate({ default_event_duration: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">1 hora</SelectItem>
              <SelectItem value="90">1h30</SelectItem>
              <SelectItem value="120">2 horas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Notificação padrão em novos eventos</Label>
            <p className="text-xs text-muted-foreground">Novos eventos terão notificação ativada automaticamente</p>
          </div>
          <Switch checked={preferences.default_event_notify}
            onCheckedChange={v => onUpdate({ default_event_notify: v })} />
        </div>
      </CardContent>
    </Card>
  );
}
