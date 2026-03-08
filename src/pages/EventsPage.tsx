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
import { format, parseISO, differenceInDays, setYear, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, PartyPopper, Trash2, Cake, Heart, Star, CalendarHeart, Gift, Phone, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReadOnly } from "@/hooks/useReadOnly";

type ImportantEvent = {
  id: string;
  title: string;
  person_name: string | null;
  event_type: string;
  event_date: string;
  is_recurring: boolean;
  notes: string | null;
  phone: string | null;
  auto_notify: boolean;
};

type FormState = {
  title: string;
  person_name: string;
  event_type: string;
  event_date: string;
  is_recurring: boolean;
  notes: string;
  phone: string;
  auto_notify: boolean;
};

const emptyForm: FormState = { title: "", person_name: "", event_type: "birthday", event_date: "", is_recurring: true, notes: "", phone: "55", auto_notify: false };

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)} (${digits.slice(2)}`;
  if (digits.length <= 9) return `${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  return `${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
};

const handlePhoneChange = (value: string, setForm: React.Dispatch<React.SetStateAction<FormState>>) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 13) {
    setForm(f => ({ ...f, phone: digits }));
  }
};

const typeIcons: Record<string, React.ElementType> = {
  birthday: Cake, anniversary: Heart, holiday: Star,
  commemoration: CalendarHeart, other: Gift,
};

const typeLabels: Record<string, string> = {
  birthday: "Aniversário", anniversary: "Aniversário de casamento",
  holiday: "Feriado", commemoration: "Comemoração", other: "Outro",
};

function getNextOccurrence(dateStr: string): Date {
  const eventDate = parseISO(dateStr);
  const today = startOfDay(new Date());
  const thisYear = setYear(eventDate, today.getFullYear());
  if (isBefore(thisYear, today)) return setYear(eventDate, today.getFullYear() + 1);
  return thisYear;
}

function getDaysUntil(dateStr: string): number {
  return differenceInDays(getNextOccurrence(dateStr), startOfDay(new Date()));
}

export default function EventsPage() {
  const { user } = useAuth();
  const { isReadOnly } = useReadOnly();
  const [events, setEvents] = useState<ImportantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ImportantEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("important_events").select("*").eq("user_id", user.id).order("event_date");
    setEvents((data as ImportantEvent[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (event: ImportantEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      person_name: event.person_name || "",
      event_type: event.event_type,
      event_date: event.event_date,
      is_recurring: event.is_recurring,
      notes: event.notes || "",
      phone: event.phone || "55",
      auto_notify: event.auto_notify,
    });
    setDialogOpen(true);
  };

  const syncToAgenda = async (eventId: string, eventPayload: typeof form) => {
    if (!user) return;
    const eventDate = parseISO(eventPayload.event_date);
    const startDate = new Date(eventDate);
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(eventDate);
    endDate.setHours(10, 0, 0, 0);

    const agendaPayload = {
      user_id: user.id,
      title: `🎂 ${eventPayload.title}`,
      description: eventPayload.notes || null,
      item_type: "reminder" as const,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      all_day: true,
      priority: "medium",
      auto_notify: eventPayload.auto_notify,
      phone: eventPayload.phone || null,
      recurrence_type: eventPayload.is_recurring ? "monthly" : "none",
      // yearly = monthly with interval 12
      recurrence_interval: eventPayload.is_recurring ? 12 : 1,
      recurrence: eventPayload.is_recurring ? "monthly" : "none",
      color: "#f59e0b",
    };

    // Check if agenda item already linked (by matching title pattern + source date)
    const { data: existing } = await supabase
      .from("agenda_items")
      .select("id")
      .eq("user_id", user.id)
      .like("title", `🎂 %`)
      .eq("start_date", startDate.toISOString());

    if (editingEvent && existing && existing.length > 0) {
      await supabase.from("agenda_items").update(agendaPayload).eq("id", existing[0].id);
    } else {
      await supabase.from("agenda_items").insert(agendaPayload);
    }
  };

  const handleSave = async () => {
    if (!user || !form.title.trim() || !form.event_date) return;
    const payload = {
      user_id: user.id,
      title: form.title,
      person_name: form.person_name || null,
      event_type: form.event_type,
      event_date: form.event_date,
      is_recurring: form.is_recurring,
      notes: form.notes || null,
      phone: form.phone || null,
      auto_notify: form.auto_notify,
    };

    let savedEventId: string | null = null;

    if (editingEvent) {
      const { error } = await supabase.from("important_events").update(payload).eq("id", editingEvent.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      savedEventId = editingEvent.id;
      toast({ title: "Evento atualizado!" });
    } else {
      const { data, error } = await supabase.from("important_events").insert(payload).select("id").single();
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      savedEventId = data.id;
      toast({ title: "Evento adicionado!" });
    }

    // Sync to agenda calendar
    if (savedEventId) {
      await syncToAgenda(savedEventId, form);
    }

    setForm(emptyForm);
    setEditingEvent(null);
    setDialogOpen(false);
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      // Remove linked agenda item
      const eventDate = parseISO(event.event_date);
      const startDate = new Date(eventDate);
      startDate.setHours(9, 0, 0, 0);
      await supabase.from("agenda_items").delete()
        .eq("user_id", user!.id)
        .like("title", `🎂 ${event.title}`)
        .eq("start_date", startDate.toISOString());
    }
    await supabase.from("important_events").delete().eq("id", id);
    fetchEvents();
  };

  const toggleNotify = async (event: ImportantEvent) => {
    await supabase.from("important_events").update({ auto_notify: !event.auto_notify }).eq("id", event.id);
    fetchEvents();
  };

  const sorted = [...events].sort((a, b) => getDaysUntil(a.event_date) - getDaysUntil(b.event_date));
  const upcoming = sorted.filter(e => getDaysUntil(e.event_date) <= 30);
  const later = sorted.filter(e => getDaysUntil(e.event_date) > 30);

  const renderEvent = (event: ImportantEvent) => {
    const daysUntil = getDaysUntil(event.event_date);
    const Icon = typeIcons[event.event_type] || Gift;
    const isClose = daysUntil <= 7;
    return (
      <div key={event.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/30", isClose && "border-warning/40 bg-warning/5")}>
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", isClose ? "bg-warning/20 text-warning" : "bg-primary/10 text-primary")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{event.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {event.person_name && <span className="text-xs text-muted-foreground">{event.person_name}</span>}
            <span className="text-xs text-muted-foreground">{format(parseISO(event.event_date), "dd/MM", { locale: ptBR })}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabels[event.event_type]}</Badge>
            {event.phone && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5"><Phone className="h-2.5 w-2.5" />{event.phone}</Badge>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-sm font-bold", isClose ? "text-warning" : "text-muted-foreground")}>
            {daysUntil === 0 ? "Hoje!" : daysUntil === 1 ? "Amanhã" : `${daysUntil} dias`}
          </p>
        </div>
        {!isReadOnly && (
        <div className="flex items-center gap-1">
          <Switch checked={event.auto_notify} onCheckedChange={() => toggleNotify(event)} title="Notificação automática" />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(event)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteEvent(event.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        )}
      </div>
    );
  };

  const renderForm = () => (
    <div className="space-y-4">
      <Input placeholder="Título (ex: Aniversário da Maria)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <Input placeholder="Nome da pessoa (opcional)" value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} />
      <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="birthday">Aniversário</SelectItem>
          <SelectItem value="anniversary">Aniversário de casamento</SelectItem>
          <SelectItem value="holiday">Feriado</SelectItem>
          <SelectItem value="commemoration">Comemoração</SelectItem>
          <SelectItem value="other">Outro</SelectItem>
        </SelectContent>
      </Select>
      <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
      <div className="flex items-center gap-2">
        <Switch checked={form.is_recurring} onCheckedChange={v => setForm(f => ({ ...f, is_recurring: v }))} />
        <Label>Recorrente (anual)</Label>
      </div>
      <div className="space-y-1">
        <Label>Celular</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-mono">+</span>
          <Input
            value={formatPhone(form.phone)}
            onChange={e => handlePhoneChange(e.target.value, setForm)}
            placeholder="55 (11) 99999-9999"
            className="font-mono text-base"
          />
        </div>
        <p className="text-xs text-muted-foreground">Formato: +55 (DDD) XXXXX-XXXX</p>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.auto_notify} onCheckedChange={v => setForm(f => ({ ...f, auto_notify: v }))} />
        <Label>Ativar notificação automática</Label>
      </div>
      <Textarea placeholder="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      <Button className="w-full" onClick={handleSave}>{editingEvent ? "Atualizar" : "Salvar"}</Button>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><PartyPopper className="h-6 w-6 text-primary" /> Datas Importantes</h1>
            <p className="text-sm text-muted-foreground">Nunca esqueça um aniversário ou data especial</p>
          </div>
          {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setEditingEvent(null); }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Evento</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingEvent ? "Editar Data Importante" : "Nova Data Importante"}</DialogTitle></DialogHeader>
              {renderForm()}
            </DialogContent>
          </Dialog>
          )}
        </div>

        {upcoming.length > 0 && (
          <Card className="border-warning/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-warning"><Gift className="h-4 w-4" /> Próximos 30 dias ({upcoming.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1">{upcoming.map(renderEvent)}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarHeart className="h-4 w-4 text-primary" /> Todos os Eventos ({later.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {later.length === 0 && upcoming.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhum evento cadastrado</p> : later.map(renderEvent)}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
