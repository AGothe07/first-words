import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { Bell, Cake, CalendarDays, Smartphone, Save, Loader2, CheckCircle2, XCircle, Wifi, WifiOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NotificationSetting = {
  id?: string;
  user_id: string;
  setting_type: string;
  message_template: string;
  send_on_day: boolean;
  send_days_before: number;
  send_both: boolean;
  is_active: boolean;
};

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

export function NotificationsSection({ preferences, onUpdate }: Props) {
  const { user } = useAuth();
  const [birthday, setBirthday] = useState<NotificationSetting | null>(null);
  const [event, setEvent] = useState<NotificationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<string>("disconnected");

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const [settingsRes, waRes] = await Promise.all([
      supabase.from("notification_settings").select("*").eq("user_id", user.id),
      supabase.from("whatsapp_instances").select("status").eq("user_id", user.id).maybeSingle(),
    ]);

    const data = settingsRes.data || [];
    const bday = data.find((s: any) => s.setting_type === "birthday");
    const evt = data.find((s: any) => s.setting_type === "event");

    setBirthday(bday ? bday as any : {
      user_id: user.id, setting_type: "birthday",
      message_template: "🎂 Feliz aniversário, {nome}! 🎉",
      send_on_day: true, send_days_before: 0, send_both: false, is_active: true,
    });
    setEvent(evt ? evt as any : {
      user_id: user.id, setting_type: "event",
      message_template: "📅 Lembrete: {evento} em {data}",
      send_on_day: true, send_days_before: 0, send_both: false, is_active: true,
    });
    setWhatsappStatus(waRes.data?.status || "disconnected");
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSetting = async (setting: NotificationSetting) => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      setting_type: setting.setting_type,
      message_template: setting.message_template,
      send_on_day: setting.send_on_day,
      send_days_before: setting.send_days_before,
      send_both: setting.send_both,
      is_active: setting.is_active,
    };
    if (setting.id) {
      await supabase.from("notification_settings").update(payload).eq("id", setting.id);
    } else {
      await supabase.from("notification_settings").insert(payload);
    }
    toast({ title: "Configuração salva!" });
    setSaving(false);
    fetchSettings();
  };

  const getSendMode = (s: NotificationSetting) => {
    if (s.send_both) return "both";
    if (s.send_days_before > 0 && !s.send_on_day) return "before";
    return "on_day";
  };

  const setSendMode = (setter: any, mode: string) => {
    setter((prev: any) => {
      if (!prev) return prev;
      if (mode === "on_day") return { ...prev, send_on_day: true, send_both: false, send_days_before: 0 };
      if (mode === "before") return { ...prev, send_on_day: false, send_both: false, send_days_before: prev.send_days_before || 1 };
      if (mode === "both") return { ...prev, send_on_day: true, send_both: true, send_days_before: prev.send_days_before || 1 };
      return prev;
    });
  };

  const renderCard = (title: string, icon: React.ElementType, setting: NotificationSetting | null, setter: any, variables: string[]) => {
    if (!setting) return null;
    const Icon = icon;
    const mode = getSendMode(setting);
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" /> {title}
            </CardTitle>
            <Switch checked={setting.is_active} onCheckedChange={v => setter((p: any) => p ? { ...p, is_active: v } : p)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Modelo da Mensagem</Label>
            <Textarea value={setting.message_template} onChange={e => setter((p: any) => p ? { ...p, message_template: e.target.value } : p)} rows={2} />
            <div className="flex gap-1 mt-1 flex-wrap">
              {variables.map(v => (
                <Badge key={v} variant="secondary" className="text-[10px] cursor-pointer"
                  onClick={() => setter((p: any) => p ? { ...p, message_template: p.message_template + ` {${v}}` } : p)}>
                  {`{${v}}`}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Quando enviar</Label>
            <Select value={mode} onValueChange={v => setSendMode(setter, v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on_day">Apenas no dia</SelectItem>
                <SelectItem value="before">X dias antes</SelectItem>
                <SelectItem value="both">No dia + X dias antes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(mode === "before" || mode === "both") && (
            <div>
              <Label className="text-xs">Dias antes</Label>
              <Input type="number" min={1} value={setting.send_days_before}
                onChange={e => setter((p: any) => p ? { ...p, send_days_before: Number(e.target.value) } : p)} />
            </div>
          )}
          <Button onClick={() => saveSetting(setting)} disabled={saving} size="sm" className="w-full gap-1">
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Global toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Notificações globais</span>
          </div>
          <Switch
            checked={preferences?.notifications_enabled ?? true}
            onCheckedChange={v => onUpdate({ notifications_enabled: v })}
          />
        </CardContent>
      </Card>

      {/* Horários padrão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Horários Padrão de Envio</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Aniversários</Label>
            <Input type="time" value={preferences?.birthday_send_time || "09:00"}
              onChange={e => onUpdate({ birthday_send_time: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Eventos</Label>
            <Input type="time" value={preferences?.events_send_time || "09:00"}
              onChange={e => onUpdate({ events_send_time: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp status */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Smartphone className="h-4 w-4 text-primary" />
            <div>
              <span className="text-sm font-medium">WhatsApp</span>
              <div className="flex items-center gap-1 mt-0.5">
                {whatsappStatus === "connected" ? (
                  <><Wifi className="h-3 w-3 text-green-500" /><span className="text-xs text-green-600">Conectado</span></>
                ) : (
                  <><WifiOff className="h-3 w-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">Desconectado</span></>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={fetchSettings}>Verificar Status</Button>
          </div>
        </CardContent>
      </Card>

      {/* Message templates */}
      <div className="grid gap-4">
        {renderCard("Aniversários", Cake, birthday, setBirthday, ["nome", "idade", "data"])}
        {renderCard("Eventos da Agenda", CalendarDays, event, setEvent, ["evento", "data", "horario_inicio"])}
      </div>
    </div>
  );
}
