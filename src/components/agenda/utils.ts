import { parseISO, addDays, addWeeks, addMonths, addYears, startOfDay, isBefore, isAfter, isSameDay, getDay } from "date-fns";
import type { AgendaItem, CalendarEvent } from "./types";

const weekdayMap: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function itemToEvent(item: AgendaItem, startOverride?: Date): CalendarEvent {
  const start = startOverride || parseISO(item.start_date);
  const origStart = parseISO(item.start_date);
  const origEnd = item.end_date ? parseISO(item.end_date) : new Date(origStart.getTime() + 3600000);
  const duration = origEnd.getTime() - origStart.getTime();
  const end = new Date(start.getTime() + duration);

  return {
    id: startOverride ? `${item.id}_${start.getTime()}` : item.id,
    originalId: item.id,
    title: item.title,
    description: item.description,
    item_type: item.item_type,
    start,
    end,
    all_day: item.all_day || false,
    status: item.status,
    priority: item.priority,
    color: item.color,
    isRecurrence: !!startOverride,
    auto_notify: item.auto_notify || false,
    recurrence_type: item.recurrence_type,
    recurrence_interval: item.recurrence_interval,
    recurrence_weekdays: item.recurrence_weekdays,
    reminder_unit: item.reminder_unit,
    reminder_value: item.reminder_value,
  };
}

export function expandEvents(items: AgendaItem[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const item of items) {
    const origStart = parseISO(item.start_date);

    // Always add the original event if it falls in range
    if (!isAfter(startOfDay(origStart), rangeEnd) && !isBefore(origStart, addDays(rangeStart, -1))) {
      events.push(itemToEvent(item));
    }

    if (!item.recurrence_type || item.recurrence_type === "none") continue;

    // Generate recurrence instances
    let cursor = new Date(origStart);
    const maxIterations = item.recurrence_type === "yearly" ? 500 : 200;
    let count = 0;

    while (count < maxIterations) {
      count++;
      if (item.recurrence_type === "weekly") {
        cursor = addWeeks(cursor, 1);
      } else if (item.recurrence_type === "monthly") {
        cursor = addMonths(cursor, 1);
      } else if (item.recurrence_type === "yearly") {
        cursor = addYears(cursor, 1);
      } else if (item.recurrence_type === "every_x_days") {
        cursor = addDays(cursor, item.recurrence_interval || 1);
      } else if (item.recurrence_type === "specific_weekdays") {
        cursor = addDays(cursor, 1);
        const weekdays = (item.recurrence_weekdays || "").split(",").map(d => weekdayMap[d.trim()]).filter(n => n !== undefined);
        while (!weekdays.includes(getDay(cursor))) {
          cursor = addDays(cursor, 1);
          count++;
          if (count >= maxIterations) break;
        }
      } else {
        break;
      }

      if (isAfter(cursor, rangeEnd)) break;
      if (isBefore(cursor, rangeStart)) continue;

      // Create instance at same time of day but on the new date
      const instanceStart = new Date(cursor);
      instanceStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
      events.push(itemToEvent(item, instanceStart));
    }
  }

  return events;
}

export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter(e => isSameDay(e.start, day));
}

export function computeOverlapColumns(events: CalendarEvent[]): Map<string, { col: number; totalCols: number }> {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const result = new Map<string, { col: number; totalCols: number }>();
  const groups: CalendarEvent[][] = [];

  for (const event of sorted) {
    let placed = false;
    for (const group of groups) {
      const overlaps = group.some(e => e.start < event.end && event.start < e.end);
      if (overlaps) {
        group.push(event);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([event]);
  }

  for (const group of groups) {
    const columns: CalendarEvent[][] = [];
    for (const event of group) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const last = columns[c][columns[c].length - 1];
        if (last.end <= event.start) {
          columns[c].push(event);
          result.set(event.id, { col: c, totalCols: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        result.set(event.id, { col: columns.length, totalCols: 0 });
        columns.push([event]);
      }
    }
    const totalCols = columns.length;
    for (const event of group) {
      const r = result.get(event.id)!;
      r.totalCols = totalCols;
    }
  }

  return result;
}
