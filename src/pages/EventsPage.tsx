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
import { format, parseISO, differenceInDays, setYear, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, PartyPopper, Trash2, Cake, Heart, Star, CalendarHeart, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

type ImportantEvent = {
  id: string;
  title: string;
  person_name: string | null;
  event_type: string;
  event_date: string;
  is_recurring: boolean;
  notes: string | null;
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
  const [events, setEvents] = useState<ImportantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", person_name: "", event_type: "birthday", event_date: "", is_recurring: true, notes: "" });

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("important_events").select("*").eq("user_id", user.id).order("event_date");
    setEvents((data as ImportantEvent[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleAdd = async () => {
    if (!user || !form.title.trim() || !form.event_date) return;
    const { error } = await supabase.from("important_events").insert({
      user_id: user.id,
      title: form.title,
      person_name: form.person_name || null,
      event_type: form.event_type,
      event_date: form.event_date,
      is_recurring: form.is_recurring,
      notes: form.notes || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Evento adicionado!" });
    setForm({ title: "", person_name: "", event_type: "birthday", event_date: "", is_recurring: true, notes: "" });
    setDialogOpen(false);
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    await supabase.from("important_events").delete().eq("id", id);
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
          <div className="flex items-center gap-2 mt-0.5">
            {event.person_name && <span className="text-xs text-muted-foreground">{event.person_name}</span>}
            <span className="text-xs text-muted-foreground">{format(parseISO(event.event_date), "dd/MM", { locale: ptBR })}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabels[event.event_type]}</Badge>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-sm font-bold", isClose ? "text-warning" : "text-muted-foreground")}>
            {daysUntil === 0 ? "Hoje!" : daysUntil === 1 ? "Amanhã" : `${daysUntil} dias`}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteEvent(event.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><PartyPopper className="h-6 w-6 text-primary" /> Datas Importantes</h1>
            <p className="text-sm text-muted-foreground">Nunca esqueça um aniversário ou data especial</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Evento</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Data Importante</DialogTitle></DialogHeader>
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
                <Textarea placeholder="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                <Button className="w-full" onClick={handleAdd}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
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
