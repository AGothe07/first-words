/**
 * Brazilian National Holidays
 * Fixed holidays + Easter-based movable holidays
 */

interface Holiday {
  date: Date;
  name: string;
}

// Easter calculation using Anonymous Gregorian algorithm
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getBrazilianHolidays(year: number): Holiday[] {
  const easter = getEasterDate(year);

  return [
    // Fixed holidays
    { date: new Date(year, 0, 1), name: "Confraternização Universal" },
    { date: new Date(year, 3, 21), name: "Tiradentes" },
    { date: new Date(year, 4, 1), name: "Dia do Trabalho" },
    { date: new Date(year, 8, 7), name: "Independência do Brasil" },
    { date: new Date(year, 9, 12), name: "Nossa Sra. Aparecida" },
    { date: new Date(year, 10, 2), name: "Finados" },
    { date: new Date(year, 10, 15), name: "Proclamação da República" },
    { date: new Date(year, 10, 20), name: "Dia da Consciência Negra" },
    { date: new Date(year, 11, 25), name: "Natal" },
    // Movable holidays (Easter-based)
    { date: addDays(easter, -47), name: "Carnaval" },
    { date: addDays(easter, -48), name: "Carnaval" },
    { date: addDays(easter, -2), name: "Sexta-feira Santa" },
    { date: easter, name: "Páscoa" },
    { date: addDays(easter, 60), name: "Corpus Christi" },
  ];
}

/**
 * Convert holidays to AgendaItem-like objects for the calendar
 */
export function getHolidayAgendaItems(year: number) {
  return getBrazilianHolidays(year).map((h, i) => ({
    id: `holiday_${year}_${i}`,
    title: `🇧🇷 ${h.name}`,
    description: "Feriado Nacional",
    item_type: "holiday" as const,
    start_date: h.date.toISOString(),
    end_date: h.date.toISOString(),
    all_day: true,
    status: "pending",
    priority: "low",
    color: "#16a34a",
    recurrence_type: "none",
    recurrence_interval: null,
    recurrence_weekdays: null,
    auto_notify: false,
    reminder_unit: null,
    reminder_value: null,
  }));
}
