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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, isToday, isTomorrow, isPast, isFuture, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, CalendarDays, Clock, Trash2, CheckCircle2, Circle, AlertCircle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  item_type: string;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  status: string;
  priority: string;
  color: string | null;
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
};

const typeLabels: Record<string, string> = {
  appointment: "Compromisso",
  reminder: "Lembrete",
  task: "Tarefa",
};

export default function AgendaPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", item_type: "appointment", start_date: new Date(), all_day: false, priority: "medium" });

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("agenda_items")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: true });
    setItems((data as AgendaItem[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async () => {
    if (!user || !form.title.trim()) return;
    const { error } = await supabase.from("agenda_items").insert({
      user_id: user.id,
      title: form.title,
      description: form.description || null,
      item_type: form.item_type,
      start_date: form.start_date.toISOString(),
      all_day: form.all_day,
      priority: form.priority,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Adicionado!" });
    setForm({ title: "", description: "", item_type: "appointment", start_date: new Date(), all_day: false, priority: "medium" });
    setDialogOpen(false);
    fetchItems();
  };

  const toggleStatus = async (item: AgendaItem) => {
    const newStatus = item.status === "completed" ? "pending" : "completed";
    await supabase.from("agenda_items").update({ status: newStatus }).eq("id", item.id);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("agenda_items").delete().eq("id", id);
    fetchItems();
  };

  const today = items.filter(i => isToday(parseISO(i.start_date)));
  const upcoming = items.filter(i => isFuture(parseISO(i.start_date)) && !isToday(parseISO(i.start_date)) && i.status !== "completed");
  const overdue = items.filter(i => isPast(parseISO(i.start_date)) && !isToday(parseISO(i.start_date)) && i.status === "pending");
  const completed = items.filter(i => i.status === "completed");

  const renderItem = (item: AgendaItem) => (
    <div key={item.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/30", item.status === "completed" && "opacity-60")}>
      <button onClick={() => toggleStatus(item)} className="shrink-0">
        {item.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium text-sm truncate", item.status === "completed" && "line-through")}>{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{format(parseISO(item.start_date), "dd/MM HH:mm", { locale: ptBR })}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabels[item.item_type]}</Badge>
          <Badge className={cn("text-[10px] px-1.5 py-0", priorityColors[item.priority])}>{item.priority}</Badge>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteItem(item.id)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary" /> Agenda</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus compromissos, lembretes e tarefas</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Compromisso</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Título" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-4">
                  <Select value={form.item_type} onValueChange={v => setForm(f => ({ ...f, item_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appointment">Compromisso</SelectItem>
                      <SelectItem value="reminder">Lembrete</SelectItem>
                      <SelectItem value="task">Tarefa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(form.start_date, "PPP", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.start_date} onSelect={d => d && setForm(f => ({ ...f, start_date: d }))} locale={ptBR} /></PopoverContent>
                </Popover>
                <Button className="w-full" onClick={handleAdd}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {overdue.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /> Atrasados ({overdue.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1">{overdue.map(renderItem)}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Hoje ({today.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {today.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhum compromisso para hoje</p> : today.map(renderItem)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Próximos ({upcoming.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhum compromisso futuro</p> : upcoming.map(renderItem)}
          </CardContent>
        </Card>

        {completed.length > 0 && (
          <Card className="opacity-70">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /> Concluídos ({completed.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1">{completed.map(renderItem)}</CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
