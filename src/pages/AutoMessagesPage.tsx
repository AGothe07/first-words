import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, MessageSquareHeart, Trash2, Mail, Phone, Bell, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AutoMessage = {
  id: string;
  title: string;
  event_id: string | null;
  message_template: string;
  channel: string;
  send_at_offset_days: number;
  send_time: string;
  is_active: boolean;
  last_sent_at: string | null;
};

type EventOption = { id: string; title: string };

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageCircle, email: Mail, sms: Phone, push: Bell,
};
const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp", email: "E-mail", sms: "SMS", push: "Notificação",
};

export default function AutoMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AutoMessage[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message_template: "", channel: "whatsapp", event_id: "", send_at_offset_days: "0", send_time: "09:00" });

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [{ data: msgs }, { data: evts }] = await Promise.all([
      supabase.from("auto_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("important_events").select("id, title").eq("user_id", user.id),
    ]);
    setMessages((msgs as AutoMessage[]) || []);
    setEvents((evts as EventOption[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!user || !form.title.trim() || !form.message_template.trim()) return;
    const { error } = await supabase.from("auto_messages").insert({
      user_id: user.id,
      title: form.title,
      message_template: form.message_template,
      channel: form.channel,
      event_id: form.event_id || null,
      send_at_offset_days: Number(form.send_at_offset_days),
      send_time: form.send_time,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mensagem configurada!" });
    setForm({ title: "", message_template: "", channel: "whatsapp", event_id: "", send_at_offset_days: "0", send_time: "09:00" });
    setDialogOpen(false);
    fetchData();
  };

  const toggleActive = async (msg: AutoMessage) => {
    await supabase.from("auto_messages").update({ is_active: !msg.is_active }).eq("id", msg.id);
    fetchData();
  };

  const deleteMsg = async (id: string) => {
    await supabase.from("auto_messages").delete().eq("id", id);
    fetchData();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><MessageSquareHeart className="h-6 w-6 text-primary" /> Mensagens Automáticas</h1>
            <p className="text-sm text-muted-foreground">Configure envios automáticos para datas especiais</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Mensagem</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Mensagem Automática</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Título (ex: Feliz Aniversário)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <Select value={form.event_id || "none"} onValueChange={v => setForm(f => ({ ...f, event_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Vincular a evento (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea placeholder="Modelo da mensagem (use {nome} para personalizar)" value={form.message_template} onChange={e => setForm(f => ({ ...f, message_template: e.target.value }))} rows={4} />
                <div className="grid grid-cols-2 gap-4">
                  <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Notificação</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="time" value={form.send_time} onChange={e => setForm(f => ({ ...f, send_time: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Enviar quantos dias antes do evento?</Label>
                  <Input type="number" value={form.send_at_offset_days} onChange={e => setForm(f => ({ ...f, send_at_offset_days: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={handleAdd}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {messages.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Nenhuma mensagem automática configurada</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => {
              const Icon = channelIcons[msg.channel] || Bell;
              const linkedEvent = events.find(e => e.id === msg.event_id);
              return (
                <Card key={msg.id} className={cn(!msg.is_active && "opacity-50")}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{msg.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{msg.message_template}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{channelLabels[msg.channel]}</Badge>
                        {linkedEvent && <Badge className="text-[10px] bg-primary/10 text-primary">{linkedEvent.title}</Badge>}
                        {msg.send_at_offset_days > 0 && <span className="text-[10px] text-muted-foreground">{msg.send_at_offset_days}d antes</span>}
                        <span className="text-[10px] text-muted-foreground">às {msg.send_time?.slice(0, 5)}</span>
                      </div>
                    </div>
                    <Switch checked={msg.is_active} onCheckedChange={() => toggleActive(msg)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteMsg(msg.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
