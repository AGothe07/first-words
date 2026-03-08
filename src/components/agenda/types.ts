export type CalendarView = "month" | "week" | "day";

export type AgendaItem = {
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
  recurrence_type: string;
  recurrence_interval: number | null;
  recurrence_weekdays: string | null;
  auto_notify: boolean;
  reminder_unit: string | null;
  reminder_value: number | null;
};

export type CalendarEvent = {
  id: string;
  originalId: string;
  title: string;
  description: string | null;
  item_type: string;
  start: Date;
  end: Date;
  all_day: boolean;
  status: string;
  priority: string;
  color: string | null;
  isRecurrence: boolean;
  auto_notify: boolean;
  recurrence_type: string;
  recurrence_interval: number | null;
  recurrence_weekdays: string | null;
  reminder_unit: string | null;
  reminder_value: number | null;
};

export type FormState = {
  title: string;
  description: string;
  item_type: string;
  start_date: Date;
  start_hour: string;
  start_minute: string;
  end_hour: string;
  end_minute: string;
  all_day: boolean;
  priority: string;
  auto_notify: boolean;
  reminder_unit: string;
  reminder_value: string;
  recurrence_type: string;
  recurrence_interval: string;
  recurrence_weekdays: string[];
};

export const emptyForm: FormState = {
  title: "", description: "", item_type: "appointment",
  start_date: new Date(), start_hour: "09", start_minute: "00",
  end_hour: "10", end_minute: "00", all_day: false,
  priority: "medium", auto_notify: false,
  reminder_unit: "minutes", reminder_value: "30",
  recurrence_type: "none", recurrence_interval: "1",
  recurrence_weekdays: [],
};

export const typeLabels: Record<string, string> = {
  appointment: "Compromisso", reminder: "Lembrete", task: "Tarefa",
};

export const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  appointment: { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary" },
  reminder: { bg: "bg-warning/15", border: "border-warning/40", text: "text-warning" },
  task: { bg: "bg-accent", border: "border-accent-foreground/20", text: "text-accent-foreground" },
  holiday: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-700 dark:text-green-400" },
};

export const HOUR_HEIGHT = 64;
