// Nigerian public holidays for leave counting.
//
// Fixed-date holidays and Easter are calculated for any year. Islamic holidays
// (Eid-el-Fitr, Eid-el-Kabir, Eid-el-Maulud) depend on the moon and are declared by
// the Federal Government each year, so HR adds them as company holidays in Settings,
// along with any extra or substitute days the government announces.

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface CompanyHoliday extends Holiday {
  id: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Easter Sunday (Gregorian), Anonymous/Meeus algorithm. */
export function easterSunday(year: number): string {
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
  return ymd(year, month, day);
}

function shift(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Nationwide holidays with fixed or calculable dates. */
export function nigeriaFixedHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { date: ymd(year, 1, 1), name: "New Year’s Day" },
    { date: shift(easter, -2), name: "Good Friday" },
    { date: shift(easter, 1), name: "Easter Monday" },
    { date: ymd(year, 5, 1), name: "Workers’ Day" },
    { date: ymd(year, 6, 12), name: "Democracy Day" },
    { date: ymd(year, 10, 1), name: "Independence Day" },
    { date: ymd(year, 12, 25), name: "Christmas Day" },
    { date: ymd(year, 12, 26), name: "Boxing Day" },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

/** All holidays (national + company) that fall between two dates, inclusive, keyed by date. */
export function holidaysBetween(start: string, end: string, company: Holiday[] = []): Map<string, string> {
  const out = new Map<string, string>();
  if (!start || !end || end < start) return out;
  const y1 = Number(start.slice(0, 4));
  const y2 = Number(end.slice(0, 4));
  for (let y = y1; y <= y2; y++) for (const h of nigeriaFixedHolidays(y)) if (h.date >= start && h.date <= end) out.set(h.date, h.name);
  for (const h of company) if (h.date >= start && h.date <= end) out.set(h.date, out.get(h.date) ?? h.name);
  return out;
}
