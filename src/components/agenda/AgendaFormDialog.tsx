import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Bell, Repeat } from "lucide-react";
import type { FormState, AgendaItem } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editingItem: AgendaItem | null;
  onSave: () => void;
  onDelete: () => void;
}

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const weekdayOptions = [
  { value: "mon", label: "Seg" }, { value: "tue", label: "Ter" }, { value: "wed", label: "Qua" },
  { value: "thu", label: "Qui" }, { value: "fri", label: "Sex" }, { value: "sat", label: "Sáb" }, { value: "sun", label: "Dom" },
];

export function AgendaFormDialog({ open, onOpenChange, form, setForm, editingItem, onSave, onDelete }: Props) {
  const toggleWeekday = (day: string) => {
    setForm(f => ({
      ...f,
      recurrence_weekdays: f.recurrence_weekdays.includes(day)
        ? f.recurrence_weekdays.filter(d => d !== day)
        : [...f.recurrence_weekdays, day],
    }));
  };

  const renderTimePicker = (label: string, hourKey: "start_hour" | "end_hour", minuteKey: "start_minute" | "end_minute") => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5 items-center">
        <Select value={form[hourKey]} onValueChange={v => setForm(f => ({ ...f, [hourKey]: v }))}>
          <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-48">{hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-muted-foreground font-bold">:</span>
        <Select value={form[minuteKey]} onValueChange={v => setForm(f => ({ ...f, [minuteKey]: v }))}>
          <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-48">{minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input placeholder="Título" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
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
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={form.start_date} onSelect={d => d && setForm(f => ({ ...f, start_date: d }))} locale={ptBR} />
            </PopoverContent>
          </Popover>
          <div className="grid grid-cols-2 gap-4">
            {renderTimePicker("Início", "start_hour", "start_minute")}
            {renderTimePicker("Término", "end_hour", "end_minute")}
          </div>

          {/* Recurrence */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Recorrência</Label>
            </div>
            <Select value={form.recurrence_type} onValueChange={v => setForm(f => ({ ...f, recurrence_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não recorrente</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="every_x_days">A cada X dias</SelectItem>
                <SelectItem value="specific_weekdays">Dias específicos</SelectItem>
              </SelectContent>
            </Select>
            {form.recurrence_type === "every_x_days" && (
              <div>
                <Label className="text-xs">A cada quantos dias?</Label>
                <Input type="number" min={1} value={form.recurrence_interval} onChange={e => setForm(f => ({ ...f, recurrence_interval: e.target.value }))} />
              </div>
            )}
            {form.recurrence_type === "specific_weekdays" && (
              <div>
                <Label className="text-xs mb-2 block">Quais dias?</Label>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map(wd => (
                    <label key={wd.value} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={form.recurrence_weekdays.includes(wd.value)} onCheckedChange={() => toggleWeekday(wd.value)} />
                      <span className="text-xs">{wd.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reminder */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Lembrete</Label>
              </div>
              <Switch checked={form.auto_notify} onCheckedChange={v => setForm(f => ({ ...f, auto_notify: v }))} />
            </div>
            {form.auto_notify && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Antecedência</Label>
                  <Input type="number" min={1} value={form.reminder_value} onChange={e => setForm(f => ({ ...f, reminder_value: e.target.value }))} />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={form.reminder_unit} onValueChange={v => setForm(f => ({ ...f, reminder_unit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutos</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                      <SelectItem value="days">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {editingItem && (
              <Button variant="destructive" className="flex-1" onClick={onDelete}>Excluir</Button>
            )}
            <Button className="flex-1" onClick={onSave}>{editingItem ? "Atualizar" : "Salvar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
