// Attendance helpers. Nigeria (West Africa Time) is UTC+1 all year, with no daylight saving,
// so "today" and clock times are worked out in Lagos time whatever the server's clock zone.

import type { AttendanceRecord } from "./types";

const HOUR = 3_600_000;
export const LATE_GRACE_MINUTES = 15;

/** YYYY-MM-DD in Lagos for an ISO timestamp. */
export function lagosDate(iso: string): string {
  return new Date(Date.parse(iso) + HOUR).toISOString().slice(0, 10);
}

/** HH:MM in Lagos for an ISO timestamp. */
export function lagosTime(iso: string): string {
  return new Date(Date.parse(iso) + HOUR).toISOString().slice(11, 16);
}

/** ISO timestamp for a Lagos date + HH:MM. */
export function lagosToIso(date: string, time: string): string {
  return new Date(Date.parse(`${date}T${time}:00Z`) - HOUR).toISOString();
}

export const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Clocked in after the start time plus a short grace period. */
export function isLate(record: AttendanceRecord, workStart: string): boolean {
  if (!isTime(workStart)) return false;
  return minutes(lagosTime(record.clockIn)) > minutes(workStart) + LATE_GRACE_MINUTES;
}

/** Hours between clock-in and clock-out (or until `now` if still clocked in), one decimal place. */
export function hoursWorked(record: AttendanceRecord, now?: Date): number | null {
  const end = record.clockOut ? Date.parse(record.clockOut) : now ? now.getTime() : null;
  if (end === null) return null;
  return Math.max(0, Math.round(((end - Date.parse(record.clockIn)) / HOUR) * 10) / 10);
}

/** The last `n` Lagos dates ending today, oldest first, weekends included. */
export function lastDays(today: string, n: number): string[] {
  const t = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(t - (n - 1 - i) * 24 * HOUR).toISOString().slice(0, 10));
}
