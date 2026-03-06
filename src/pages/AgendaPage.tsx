import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "@/hooks/use-toast";
import { parseISO, setHours, setMinutes, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from "date-fns";
import { CalendarHeader } from "@/components/agenda/CalendarHeader";
import { MonthView } from "@/components/agenda/MonthView";
import { TimeGrid } from "@/components/agenda/TimeGrid";
import { AgendaFormDialog } from "@/components/agenda/AgendaFormDialog";
import { expandEvents } from "@/components/agenda/utils";
import type { AgendaItem, CalendarEvent, CalendarView, FormState } from "@/components/agenda/types";
import { emptyForm } from "@/components/agenda/types";
import { useReadOnly } from "@/hooks/useReadOnly";

export default function AgendaPage() {
  const { user } = useAuth();
  const { isReadOnly } = useReadOnly();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

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

  // Compute visible range and expanded events
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const ms = startOfMonth(currentDate);
      return { rangeStart: startOfWeek(ms, { weekStartsOn: 0 }), rangeEnd: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }) };
    }
    if (view === "week") {
      return { rangeStart: startOfWeek(currentDate, { weekStartsOn: 0 }), rangeEnd: endOfWeek(currentDate, { weekStartsOn: 0 }) };
    }
    return { rangeStart: startOfDay(currentDate), rangeEnd: endOfDay(currentDate) };
  }, [currentDate, view]);

  const events = useMemo(() => expandEvents(items, rangeStart, rangeEnd), [items, rangeStart, rangeEnd]);

  // Days for time grid
  const gridDays = useMemo(() => {
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return [startOfDay(currentDate)];
  }, [currentDate, view]);

  // Open create dialog with pre-filled date/time
  const openCreate = (date?: Date) => {
    if (isReadOnly) return;
    setEditingItem(null);
    const d = date || new Date();
    setForm({
      ...emptyForm,
      start_date: d,
      start_hour: String(d.getHours()).padStart(2, "0"),
      start_minute: String(Math.round(d.getMinutes() / 5) * 5).padStart(2, "0"),
      end_hour: String(d.getHours() + 1).padStart(2, "0"),
      end_minute: String(Math.round(d.getMinutes() / 5) * 5).padStart(2, "0"),
    });
    setDialogOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    if (isReadOnly) return;
    const item = items.find(i => i.id === ev.originalId);
    if (!item) return;
    setEditingItem(item);
    const startD = parseISO(item.start_date);
    const endD = item.end_date ? parseISO(item.end_date) : null;
    setForm({
      title: item.title,
      description: item.description || "",
      item_type: item.item_type,
      start_date: startD,
      start_hour: String(startD.getHours()).padStart(2, "0"),
      start_minute: String(startD.getMinutes()).padStart(2, "0"),
      end_hour: endD ? String(endD.getHours()).padStart(2, "0") : String(startD.getHours() + 1).padStart(2, "0"),
      end_minute: endD ? String(endD.getMinutes()).padStart(2, "0") : String(startD.getMinutes()).padStart(2, "0"),
      all_day: item.all_day || false,
      priority: item.priority,
      auto_notify: item.auto_notify || false,
      reminder_unit: item.reminder_unit || "minutes",
      reminder_value: String(item.reminder_value || 30),
      recurrence_type: item.recurrence_type || "none",
      recurrence_interval: String(item.recurrence_interval || 1),
      recurrence_weekdays: item.recurrence_weekdays ? item.recurrence_weekdays.split(",") : [],
    });
    setDialogOpen(true);
  };

  const buildDates = () => {
    let start = new Date(form.start_date);
    start = setHours(start, Number(form.start_hour));
    start = setMinutes(start, Number(form.start_minute));
    let end = new Date(form.start_date);
    end = setHours(end, Number(form.end_hour));
    end = setMinutes(end, Number(form.end_minute));
    return { start, end };
  };

  const handleSave = async () => {
    if (!user || !form.title.trim()) return;
    const { start, end } = buildDates();
    const payload: any = {
      user_id: user.id, title: form.title, description: form.description || null,
      item_type: form.item_type, start_date: start.toISOString(), end_date: end.toISOString(),
      all_day: form.all_day, priority: form.priority, auto_notify: form.auto_notify,
      reminder_unit: form.auto_notify ? form.reminder_unit : null,
      reminder_value: form.auto_notify ? Number(form.reminder_value) : null,
      recurrence_type: form.recurrence_type,
      recurrence_interval: form.recurrence_type === "every_x_days" ? Number(form.recurrence_interval) : 1,
      recurrence_weekdays: form.recurrence_type === "specific_weekdays" ? form.recurrence_weekdays.join(",") : null,
      recurrence: form.recurrence_type === "weekly" ? "weekly" : form.recurrence_type === "monthly" ? "monthly" : form.recurrence_type === "every_x_days" ? "daily" : form.recurrence_type === "specific_weekdays" ? "weekly" : "none",
    };

    if (editingItem) {
      const { error } = await supabase.from("agenda_items").update(payload).eq("id", editingItem.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Evento atualizado!" });
    } else {
      const { error } = await supabase.from("agenda_items").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Evento criado!" });
    }
    setDialogOpen(false);
    setEditingItem(null);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    await supabase.from("agenda_items").delete().eq("id", editingItem.id);
    setDialogOpen(false);
    setEditingItem(null);
    fetchItems();
    toast({ title: "Evento excluído" });
  };

  const handleEventMove = async (eventId: string, newStart: Date, newEnd: Date) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === eventId
        ? { ...item, start_date: newStart.toISOString(), end_date: newEnd.toISOString() }
        : item
    ));
    const { error } = await supabase.from("agenda_items").update({
      start_date: newStart.toISOString(),
      end_date: newEnd.toISOString(),
    }).eq("id", eventId);
    if (error) {
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
      fetchItems(); // Revert on error
    }
  };

  const handleEventResize = async (eventId: string, newEnd: Date, newStart?: Date) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === eventId
        ? { ...item, end_date: newEnd.toISOString(), ...(newStart ? { start_date: newStart.toISOString() } : {}) }
        : item
    ));
    const update: any = { end_date: newEnd.toISOString() };
    if (newStart) update.start_date = newStart.toISOString();
    const { error } = await supabase.from("agenda_items").update(update).eq("id", eventId);
    if (error) {
      toast({ title: "Erro ao redimensionar", description: error.message, variant: "destructive" });
      fetchItems(); // Revert on error
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onDateChange={setCurrentDate}
          onViewChange={setView}
          onNewEvent={() => !isReadOnly && openCreate()}
        />

        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onSlotClick={openCreate}
            onEventClick={openEdit}
          />
        )}

        {(view === "week" || view === "day") && (
          <TimeGrid
            days={gridDays}
            events={events}
            onSlotClick={openCreate}
            onEventClick={openEdit}
            onEventMove={handleEventMove}
            onEventResize={handleEventResize}
          />
        )}

        <AgendaFormDialog
          open={dialogOpen}
          onOpenChange={v => { setDialogOpen(v); if (!v) setEditingItem(null); }}
          form={form}
          setForm={setForm}
          editingItem={editingItem}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
    </AppLayout>
  );
}
