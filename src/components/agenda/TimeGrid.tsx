import { useRef, useState, useCallback, useEffect } from "react";
import { format, isToday, differenceInMinutes, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getEventsForDay, computeOverlapColumns } from "./utils";
import { typeColors, HOUR_HEIGHT } from "./types";
import type { CalendarEvent } from "./types";
import { RecurrenceActionModal } from "./RecurrenceActionModal";

interface Props {
  days: Date[];
  events: CalendarEvent[];
  onSlotClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventMove: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventResize: (eventId: string, newEnd: Date, newStart?: Date) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const TIME_COL_WIDTH = 56; // w-14 = 3.5rem = 56px

function getTopAndHeight(event: CalendarEvent) {
  const startMin = event.start.getHours() * 60 + event.start.getMinutes();
  const endMin = event.end.getHours() * 60 + event.end.getMinutes();
  const duration = Math.max(endMin - startMin, 15);
  return {
    top: (startMin / 60) * HOUR_HEIGHT,
    height: Math.max((duration / 60) * HOUR_HEIGHT, 16),
  };
}

function minutesToTime(totalMinutes: number) {
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type DragState = {
  eventId: string;
  type: "move" | "resize-top" | "resize-bottom";
  startY: number;
  startX: number;
  origTop: number;
  origHeight: number;
  dayIndex: number;
  event: CalendarEvent;
};

type PendingAction = {
  type: "move" | "resize";
  eventId: string;
  newStart: Date;
  newEnd: Date;
  isRecurrence: boolean;
};

export function TimeGrid({ days, events, onSlotClick, onEventClick, onEventMove, onEventResize }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState({ dy: 0, dx: 0 });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const didDragRef = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    setDragDelta({
      dy: e.clientY - dragging.startY,
      dx: e.clientX - dragging.startX,
    });
  }, [dragging]);

  const getSnappedMinuteDelta = useCallback((dy: number) => {
    return Math.round((dy / HOUR_HEIGHT) * 60 / 5) * 5;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragging || !gridRef.current) {
      setDragging(null);
      setDragDelta({ dy: 0, dx: 0 });
      return;
    }

    const dayColEls = gridRef.current.querySelectorAll("[data-day-col]");
    const colWidth = dayColEls.length > 0 ? (dayColEls[0] as HTMLElement).offsetWidth : gridRef.current.offsetWidth / days.length;
    const minuteDelta = getSnappedMinuteDelta(dragDelta.dy);

    const hasMoved = dragging.type === "move"
      ? (minuteDelta !== 0 || Math.abs(dragDelta.dx) > 5)
      : minuteDelta !== 0;

    if (hasMoved) {
      didDragRef.current = true;
      // Reset after a tick so the click event is suppressed
      setTimeout(() => { didDragRef.current = false; }, 0);
    }

    if (dragging.type === "move") {
      const dayShift = Math.round(dragDelta.dx / colWidth);
      const newStart = addMinutes(dragging.event.start, minuteDelta + dayShift * 24 * 60);
      const duration = differenceInMinutes(dragging.event.end, dragging.event.start);
      const newEnd = addMinutes(newStart, duration);
      if (minuteDelta !== 0 || dayShift !== 0) {
        if (dragging.event.isRecurrence || dragging.event.recurrence_type !== "none") {
          setPendingAction({ type: "move", eventId: dragging.event.originalId, newStart, newEnd, isRecurrence: true });
        } else {
          onEventMove(dragging.event.originalId, newStart, newEnd);
        }
      }
    } else if (dragging.type === "resize-bottom") {
      const newEnd = addMinutes(dragging.event.end, minuteDelta);
      if (minuteDelta !== 0) {
        if (dragging.event.isRecurrence || dragging.event.recurrence_type !== "none") {
          setPendingAction({ type: "resize", eventId: dragging.event.originalId, newStart: dragging.event.start, newEnd, isRecurrence: true });
        } else {
          onEventResize(dragging.event.originalId, newEnd);
        }
      }
    } else if (dragging.type === "resize-top") {
      const newStart = addMinutes(dragging.event.start, minuteDelta);
      if (minuteDelta !== 0) {
        if (dragging.event.isRecurrence || dragging.event.recurrence_type !== "none") {
          setPendingAction({ type: "resize", eventId: dragging.event.originalId, newStart, newEnd: dragging.event.end, isRecurrence: true });
        } else {
          onEventResize(dragging.event.originalId, dragging.event.end, newStart);
        }
      }
    }

    setDragging(null);
    setDragDelta({ dy: 0, dx: 0 });
  }, [dragging, dragDelta, days.length, onEventMove, onEventResize, getSnappedMinuteDelta]);

  useEffect(() => {
    if (!dragging) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = dragging.type === "move" ? "grabbing" : "ns-resize";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const startDrag = (e: React.MouseEvent, event: CalendarEvent, type: DragState["type"], dayIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = getTopAndHeight(event);
    setDragging({
      eventId: event.id,
      type,
      startY: e.clientY,
      startX: e.clientX,
      origTop: pos.top,
      origHeight: pos.height,
      dayIndex,
      event,
    });
    setDragDelta({ dy: 0, dx: 0 });
  };

  const handleSlotClick = (day: Date, hour: number) => {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onSlotClick(d);
  };

  // Compute preview time label during drag
  const getDragPreview = () => {
    if (!dragging) return null;
    const minuteDelta = getSnappedMinuteDelta(dragDelta.dy);
    const ev = dragging.event;
    const startMin = ev.start.getHours() * 60 + ev.start.getMinutes();
    const endMin = ev.end.getHours() * 60 + ev.end.getMinutes();

    if (dragging.type === "move") {
      return {
        start: minutesToTime(startMin + minuteDelta),
        end: minutesToTime(endMin + minuteDelta),
      };
    } else if (dragging.type === "resize-bottom") {
      return {
        start: minutesToTime(startMin),
        end: minutesToTime(endMin + minuteDelta),
      };
    } else {
      return {
        start: minutesToTime(startMin + minuteDelta),
        end: minutesToTime(endMin),
      };
    }
  };

  const isMultiDay = days.length > 1;
  const dragPreview = getDragPreview();

  return (
    <>
      <div className="border rounded-lg overflow-hidden bg-background flex flex-col">
        {/* Scrollable container wrapping both header and grid for perfect alignment */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {/* Day headers - inside scroll container so columns align perfectly */}
          {isMultiDay && (
            <div className="flex border-b bg-muted/30 sticky top-0 z-10">
              <div className="shrink-0" style={{ width: TIME_COL_WIDTH }} />
              {days.map((day, i) => (
                <div key={i} className={cn("flex-1 text-center py-2 border-l", isToday(day) && "bg-primary/5")}>
                  <div className="text-xs text-muted-foreground uppercase">{format(day, "EEE", { locale: ptBR })}</div>
                  <div className={cn(
                    "text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full",
                    isToday(day) && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex relative" ref={gridRef}>
            {/* Hour labels */}
            <div className="shrink-0" style={{ width: TIME_COL_WIDTH }}>
              {hours.map(h => (
                <div key={h} className="border-b border-border/50 relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground font-mono">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, dayIdx) => {
              const dayEvents = getEventsForDay(events, day).filter(e => !e.all_day);
              const columns = computeOverlapColumns(dayEvents);

              return (
                <div
                  key={dayIdx}
                  data-day-col
                  className={cn("flex-1 relative border-l", isToday(day) && "bg-primary/[0.02]")}
                >
                  {/* Hour slots */}
                  {hours.map(h => (
                    <div
                      key={h}
                      className="border-b border-border/50 cursor-pointer hover:bg-accent/20 transition-colors"
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => handleSlotClick(day, h)}
                    >
                      {/* Half-hour line */}
                      <div className="border-b border-dotted border-border/20" style={{ height: HOUR_HEIGHT / 2 }} />
                    </div>
                  ))}

                  {/* Now indicator */}
                  {isToday(day) && (() => {
                    const now = new Date();
                    const mins = now.getHours() * 60 + now.getMinutes();
                    const top = (mins / 60) * HOUR_HEIGHT;
                    return (
                      <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-destructive -ml-1" />
                          <div className="flex-1 h-px bg-destructive" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Events */}
                  {dayEvents.map(ev => {
                    const pos = getTopAndHeight(ev);
                    const overlap = columns.get(ev.id) || { col: 0, totalCols: 1 };
                    const colors = typeColors[ev.item_type] || typeColors.appointment;
                    const isDraggingThis = dragging?.eventId === ev.id;

                    let style: React.CSSProperties = {
                      top: pos.top,
                      height: pos.height,
                      left: `${(overlap.col / overlap.totalCols) * 100}%`,
                      width: `${(1 / overlap.totalCols) * 100 - 2}%`,
                      transition: isDraggingThis ? "none" : "top 0.15s ease, height 0.15s ease",
                    };

                    if (isDraggingThis) {
                      if (dragging.type === "move") {
                        style.top = pos.top + dragDelta.dy;
                        style.transform = `translateX(${dragDelta.dx}px)`;
                        style.zIndex = 50;
                        style.opacity = 0.85;
                        style.boxShadow = "0 8px 24px -4px rgba(0,0,0,0.2)";
                      } else if (dragging.type === "resize-bottom") {
                        style.height = Math.max(pos.height + dragDelta.dy, 16);
                        style.zIndex = 50;
                      } else if (dragging.type === "resize-top") {
                        style.top = pos.top + dragDelta.dy;
                        style.height = Math.max(pos.height - dragDelta.dy, 16);
                        style.zIndex = 50;
                      }
                    }

                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          "absolute rounded-md border px-1.5 py-0.5 select-none overflow-hidden group",
                          colors.bg, colors.border,
                          ev.status === "completed" && "opacity-50",
                          isDraggingThis ? "shadow-lg" : "cursor-grab hover:shadow-md active:cursor-grabbing",
                        )}
                        style={style}
                        onClick={(e) => { e.stopPropagation(); if (!dragging && !didDragRef.current) onEventClick(ev); }}
                        onMouseDown={(e) => startDrag(e, ev, "move", dayIdx)}
                      >
                        {/* Top resize handle */}
                        <div
                          className="absolute top-0 left-0 right-0 h-2 cursor-n-resize z-10 opacity-0 group-hover:opacity-100 hover:bg-foreground/10 rounded-t-md"
                          onMouseDown={(e) => startDrag(e, ev, "resize-top", dayIdx)}
                        />

                        {/* Content */}
                        <div className={cn("text-[11px] font-medium truncate", colors.text, ev.status === "completed" && "line-through")}>
                          {ev.title}
                        </div>
                        {pos.height > 30 && (
                          <div className="text-[10px] text-muted-foreground">
                            {isDraggingThis && dragPreview
                              ? `${dragPreview.start} – ${dragPreview.end}`
                              : `${format(ev.start, "HH:mm")} – ${format(ev.end, "HH:mm")}`
                            }
                          </div>
                        )}

                        {/* Drag time tooltip */}
                        {isDraggingThis && dragPreview && pos.height <= 30 && (
                          <div className="absolute -top-6 left-0 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md border whitespace-nowrap z-50">
                            {dragPreview.start} – {dragPreview.end}
                          </div>
                        )}

                        {/* Bottom resize handle */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-10 opacity-0 group-hover:opacity-100 hover:bg-foreground/10 rounded-b-md"
                          onMouseDown={(e) => startDrag(e, ev, "resize-bottom", dayIdx)}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recurrence confirmation modal */}
      <RecurrenceActionModal
        open={!!pendingAction}
        onOpenChange={(v) => { if (!v) setPendingAction(null); }}
        actionLabel={pendingAction?.type === "move" ? "mover" : "redimensionar"}
        onThisOnly={() => {
          if (!pendingAction) return;
          // For "this only" on recurrence, we apply same action (simplified - applies to original)
          if (pendingAction.type === "move") {
            onEventMove(pendingAction.eventId, pendingAction.newStart, pendingAction.newEnd);
          } else {
            onEventResize(pendingAction.eventId, pendingAction.newEnd, pendingAction.newStart);
          }
          setPendingAction(null);
        }}
        onAll={() => {
          if (!pendingAction) return;
          if (pendingAction.type === "move") {
            onEventMove(pendingAction.eventId, pendingAction.newStart, pendingAction.newEnd);
          } else {
            onEventResize(pendingAction.eventId, pendingAction.newEnd, pendingAction.newStart);
          }
          setPendingAction(null);
        }}
      />
    </>
  );
}
