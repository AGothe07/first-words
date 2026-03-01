import { format, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarView } from "./types";

interface Props {
  currentDate: Date;
  view: CalendarView;
  onDateChange: (d: Date) => void;
  onViewChange: (v: CalendarView) => void;
  onNewEvent: () => void;
}

export function CalendarHeader({ currentDate, view, onDateChange, onViewChange, onNewEvent }: Props) {
  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    onDateChange(d);
  };

  const label = () => {
    if (view === "month") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, "dd MMM", { locale: ptBR })} – ${format(we, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
  };

  const views: { key: CalendarView; label: string }[] = [
    { key: "month", label: "Mês" },
    { key: "week", label: "Semana" },
    { key: "day", label: "Dia" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onNewEvent}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDateChange(new Date())}>Hoje</Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold capitalize ml-1">{label()}</h2>
      </div>
      <div className="flex rounded-lg border bg-muted p-0.5">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              view === v.key ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
