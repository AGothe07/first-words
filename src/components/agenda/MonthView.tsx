import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getEventsForDay } from "./utils";
import { typeColors } from "./types";
import type { CalendarEvent } from "./types";

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onSlotClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthView({ currentDate, events, onSlotClick, onEventClick }: Props) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weeks: Date[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  const MAX_VISIBLE = 3;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekDays.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0" style={{ minHeight: 100 }}>
          {week.map((day, di) => {
            const dayEvents = getEventsForDay(events, day);
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);

            return (
              <div
                key={di}
                className={cn(
                  "border-r last:border-r-0 p-1 cursor-pointer transition-colors hover:bg-accent/20 relative",
                  !inMonth && "bg-muted/20"
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-event]")) return;
                  const d = new Date(day);
                  d.setHours(9, 0, 0, 0);
                  onSlotClick(d);
                }}
              >
                <div className={cn(
                  "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                  today && "bg-primary text-primary-foreground",
                  !inMonth && "text-muted-foreground/50"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, MAX_VISIBLE).map(ev => {
                    const colors = typeColors[ev.item_type] || typeColors.appointment;
                    return (
                      <div
                        key={ev.id}
                        data-event
                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        className={cn(
                          "text-[10px] leading-tight px-1.5 py-0.5 rounded truncate border cursor-pointer transition-opacity hover:opacity-80",
                          colors.bg, colors.border, colors.text,
                          ev.status === "completed" && "opacity-50 line-through"
                        )}
                        title={ev.title}
                      >
                        {!ev.all_day && (
                          <span className="font-medium">{format(ev.start, "HH:mm")} </span>
                        )}
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > MAX_VISIBLE && (
                    <div className="text-[10px] text-muted-foreground pl-1 font-medium">
                      +{dayEvents.length - MAX_VISIBLE} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
