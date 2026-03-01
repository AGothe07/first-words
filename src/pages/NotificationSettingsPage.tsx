import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Cake, CalendarDays, Save, Send, Loader2, CheckCircle2, XCircle, Smartphone } from "lucide-react";
import WhatsAppTab from "@/components/notifications/WhatsAppTab";

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

const defaultBirthday: Omit<NotificationSetting, "user_id"> = {
  setting_type: "birthday",
  message_template: "🎂 Feliz aniversário, {nome}! Hoje você completa {idade} anos! 🎉",
  send_on_day: true,
  send_days_before: 0,
  send_both: false,
  is_active: true,
};

const defaultEvent: Omit<NotificationSetting, "user_id"> = {
  setting_type: "event",
  message_template: "📅 Lembrete: {evento} em {data} às {horario_inicio}",
  send_on_day: true,
  send_days_before: 0,
  send_both: false,
  is_active: true,
};

type TestableItem = {
  id: string;
  title: string;
  source_type: "birthday" | "agenda";
  subtitle: string;
};

type TestResult = {
  success: boolean;
  title: string;
  status_code: number;
  payload_sent: Record<string, unknown>;
  response: string;
  error?: string;
};

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const [birthday, setBirthday] = useState<NotificationSetting | null>(null);
  const [event, setEvent] = useState<NotificationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Test send state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testItems, setTestItems] = useState<TestableItem[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id);

    const bday = (data || []).find((s: any) => s.setting_type === "birthday");
    const evt = (data || []).find((s: any) => s.setting_type === "event");

    setBirthday(bday ? bday as NotificationSetting : { ...defaultBirthday, user_id: user.id });
    setEvent(evt ? evt as NotificationSetting : { ...defaultEvent, user_id: user.id });
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
      const { error } = await supabase
        .from("notification_settings")
        .update(payload)
        .eq("id", setting.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("notification_settings")
        .insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSaving(false); return; }
    }

    toast({ title: "Configuração salva!" });
    setSaving(false);
    fetchSettings();
  };

  const getSendModeValue = (s: NotificationSetting) => {
    if (s.send_both) return "both";
    if (s.send_days_before > 0 && !s.send_on_day) return "before";
    return "on_day";
  };

  const setSendMode = (
    setter: React.Dispatch<React.SetStateAction<NotificationSetting | null>>,
    mode: string
  ) => {
    setter(prev => {
      if (!prev) return prev;
      if (mode === "on_day") return { ...prev, send_on_day: true, send_both: false, send_days_before: 0 };
      if (mode === "before") return { ...prev, send_on_day: false, send_both: false, send_days_before: prev.send_days_before || 1 };
      if (mode === "both") return { ...prev, send_on_day: true, send_both: true, send_days_before: prev.send_days_before || 1 };
      return prev;
    });
  };

  // Test send functions
  const openTestDialog = async () => {
    if (!user) return;
    setTestDialogOpen(true);
    setTestLoading(true);
    setTestResult(null);
    setSelectedTestId("");

    const [eventsRes, agendaRes] = await Promise.all([
      supabase.from("important_events").select("id, title, person_name, event_type, phone").eq("user_id", user.id).order("event_date"),
      supabase.from("agenda_items").select("id, title, start_date, item_type").eq("user_id", user.id).order("start_date", { ascending: true }),
    ]);

    const items: TestableItem[] = [];

    for (const e of (eventsRes.data || []) as any[]) {
      items.push({
        id: `birthday::${e.id}`,
        title: e.title,
        source_type: "birthday",
        subtitle: `${e.person_name || "—"} • ${e.phone ? `📱 ${e.phone}` : "⚠️ Sem telefone"}`,
      });
    }

    for (const a of (agendaRes.data || []) as any[]) {
      const d = new Date(a.start_date);
      items.push({
        id: `agenda::${a.id}`,
        title: a.title,
        source_type: "agenda",
        subtitle: `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      });
    }

    setTestItems(items);
    setTestLoading(false);
  };

  const handleTestSend = async () => {
    if (!user || !selectedTestId) return;
    const [sourceType, sourceId] = selectedTestId.split("::");
    setSending(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-notification", {
        body: { source_type: sourceType, source_id: sourceId, user_id: user.id },
      });

      if (error) {
        // Try to parse error context from FunctionsHttpError
        let errorMsg = error.message;
        try {
          if ((error as any).context) {
            const body = await (error as any).context.json();
            if (body?.error) errorMsg = body.error;
          }
        } catch {}
        setTestResult({ success: false, title: "", status_code: 0, payload_sent: {}, response: "", error: errorMsg });
      } else if (data?.error) {
        setTestResult({ success: false, title: "", status_code: 0, payload_sent: {}, response: "", error: data.error });
      } else {
        setTestResult(data as TestResult);
      }
    } catch (err: any) {
      setTestResult({ success: false, title: "", status_code: 0, payload_sent: {}, response: "", error: err.message });
    }

    setSending(false);
  };

  const renderSettingCard = (
    title: string,
    icon: React.ElementType,
    setting: NotificationSetting | null,
    setter: React.Dispatch<React.SetStateAction<NotificationSetting | null>>,
    variables: string[]
  ) => {
    if (!setting) return null;
    const Icon = icon;
    const mode = getSendModeValue(setting);

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" /> {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Ativo</Label>
              <Switch checked={setting.is_active} onCheckedChange={v => setter(prev => prev ? { ...prev, is_active: v } : prev)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Modelo da Mensagem</Label>
            <Textarea
              value={setting.message_template}
              onChange={e => setter(prev => prev ? { ...prev, message_template: e.target.value } : prev)}
              rows={3}
              placeholder="Escreva sua mensagem modelo..."
            />
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {variables.map(v => (
                <Badge key={v} variant="secondary" className="text-[10px] cursor-pointer"
                  onClick={() => setter(prev => prev ? { ...prev, message_template: prev.message_template + ` {${v}}` } : prev)}>
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
                <SelectItem value="before">Apenas X dias antes</SelectItem>
                <SelectItem value="both">No dia + X dias antes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(mode === "before" || mode === "both") && (
            <div>
              <Label className="text-xs">Quantos dias antes?</Label>
              <Input
                type="number"
                min={1}
                value={setting.send_days_before}
                onChange={e => setter(prev => prev ? { ...prev, send_days_before: Number(e.target.value) } : prev)}
              />
            </div>
          )}

          <Button onClick={() => saveSetting(setting)} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" /> Salvar Configuração
          </Button>
        </CardContent>
      </Card>
    );
  };

  const selectedItem = testItems.find(i => i.id === selectedTestId);

  if (loading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Carregando...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" /> Configurações de Notificação
            </h1>
            <p className="text-sm text-muted-foreground">Configure mensagens automáticas para aniversários e eventos</p>
            <p className="text-xs text-muted-foreground mt-1">🎂 Aniversários → envia para o celular do aniversariante • 📅 Lembretes → envia para o celular do seu perfil</p>
          </div>
          <Button variant="outline" onClick={openTestDialog} className="gap-2">
            <Send className="h-4 w-4" /> Testar Envio
          </Button>
        </div>

        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="messages" className="gap-2"><Bell className="h-4 w-4" /> Mensagens</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2"><Smartphone className="h-4 w-4" /> WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-4">
            <div className="grid gap-4">
              {renderSettingCard("Aniversários", Cake, birthday, setBirthday, ["nome", "idade", "data"])}
              {renderSettingCard("Eventos da Agenda", CalendarDays, event, setEvent, ["evento", "data", "horario_inicio", "horario_fim"])}
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4">
            <WhatsAppTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Test Send Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Testar Envio de Notificação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um evento ou compromisso da agenda para simular o envio real do webhook, exatamente como aconteceria no momento programado.
            </p>

            {testLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs mb-1.5 block">Selecionar item para teste</Label>
                  <Select value={selectedTestId} onValueChange={v => { setSelectedTestId(v); setTestResult(null); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um evento ou agenda..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {testItems.filter(i => i.source_type === "birthday").length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">🎂 Datas Importantes</div>
                          {testItems.filter(i => i.source_type === "birthday").map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              <span className="flex flex-col">
                                <span>{item.title}</span>
                                <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {testItems.filter(i => i.source_type === "agenda").length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">📅 Agenda</div>
                          {testItems.filter(i => i.source_type === "agenda").map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              <span className="flex flex-col">
                                <span>{item.title}</span>
                                <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {testItems.length === 0 && (
                        <div className="px-2 py-4 text-sm text-center text-muted-foreground">Nenhum evento ou agenda cadastrado</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItem && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium">{selectedItem.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tipo: {selectedItem.source_type === "birthday" ? "Data Importante (webhook aniversário)" : "Agenda (webhook lembrete)"}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedItem.subtitle}</p>
                  </div>
                )}

                <Button
                  onClick={handleTestSend}
                  disabled={!selectedTestId || sending}
                  className="w-full gap-2"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending ? "Enviando..." : "Enviar Teste Agora"}
                </Button>

                {testResult && (
                  <div className={`p-4 rounded-lg border space-y-2 ${testResult.success ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <span className="font-medium text-sm">
                        {testResult.success ? "Enviado com sucesso!" : "Falha no envio"}
                      </span>
                      {testResult.status_code > 0 && (
                        <Badge variant={testResult.success ? "default" : "destructive"} className="text-[10px]">
                          HTTP {testResult.status_code}
                        </Badge>
                      )}
                    </div>

                    {testResult.error && (
                      <p className="text-sm text-destructive">{testResult.error}</p>
                    )}

                    {testResult.payload_sent && Object.keys(testResult.payload_sent).length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver payload enviado</summary>
                        <pre className="mt-2 p-2 rounded bg-muted text-[11px] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(testResult.payload_sent, null, 2)}
                        </pre>
                      </details>
                    )}

                    {testResult.response && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver resposta do webhook</summary>
                        <pre className="mt-2 p-2 rounded bg-muted text-[11px] overflow-x-auto whitespace-pre-wrap">
                          {testResult.response}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
