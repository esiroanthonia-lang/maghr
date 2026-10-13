// Numbers behind the role dashboards. Pure functions over the app state.

import { lagosDate } from "./attendance";
import type { DemoState } from "./demo-data";
import type { Employee, LeaveRequest, Review } from "./types";

const norm = (s: string) => s.trim().toLowerCase();

/** People who report to this manager (current staff only). */
export function teamOf(state: DemoState, managerName: string): Employee[] {
  const m = norm(managerName);
  if (!m) return [];
  return state.employees.filter((e) => e.status !== "Exited" && norm(e.managerName) === m);
}

/** Days from `fromIso` to the next time the month-day of `iso` comes round (0 = today). */
export function daysUntilAnniversary(iso: string, fromIso: string): number {
  const [, m, d] = iso.split("-").map(Number);
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  let next = Date.UTC(fy, m - 1, d);
  if (next < from) next = Date.UTC(fy + 1, m - 1, d);
  return Math.round((next - from) / 86400000);
}

export interface Moment {
  employeeId: string;
  name: string;
  kind: "Birthday" | "Work anniversary";
  inDays: number;
  /** Years completed, for anniversaries. */
  years?: number;
}

/** Birthdays and work anniversaries coming up. Birthdays only appear where the person's record is visible. */
export function upcomingMoments(state: DemoState, todayIso: string, withinDays = 14, employeeIds?: Set<string>): Moment[] {
  const out: Moment[] = [];
  for (const e of state.employees) {
    if (e.status === "Exited") continue;
    if (employeeIds && !employeeIds.has(e.id)) continue;
    const dob = state.records[e.id]?.personal.dateOfBirth;
    if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      const inDays = daysUntilAnniversary(dob, todayIso);
      if (inDays <= withinDays) out.push({ employeeId: e.id, name: e.name, kind: "Birthday", inDays });
    }
    if (e.status === "Active" && /^\d{4}-\d{2}-\d{2}$/.test(e.startDate)) {
      const inDays = daysUntilAnniversary(e.startDate, todayIso);
      const nextYear = new Date(Date.parse(`${todayIso}T00:00:00Z`) + inDays * 86400000).getUTCFullYear();
      const years = nextYear - Number(e.startDate.slice(0, 4));
      if (inDays <= withinDays && years >= 1) out.push({ employeeId: e.id, name: e.name, kind: "Work anniversary", inDays, years });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
}

/** Staff whose probation ends within the window (or is overdue by up to 30 days and not yet confirmed). */
export function probationEnding(state: DemoState, todayIso: string, withinDays = 30, employeeIds?: Set<string>): { employee: Employee; probationEnd: string; inDays: number }[] {
  const t = Date.parse(`${todayIso}T00:00:00Z`);
  const out: { employee: Employee; probationEnd: string; inDays: number }[] = [];
  for (const e of state.employees) {
    if (e.status === "Exited") continue;
    if (employeeIds && !employeeIds.has(e.id)) continue;
    const job = state.records[e.id]?.job;
    if (!job?.probationEnd || job.confirmedOn) continue;
    const inDays = Math.round((Date.parse(`${job.probationEnd}T00:00:00Z`) - t) / 86400000);
    if (inDays <= withinDays && inDays >= -30) out.push({ employee: e, probationEnd: job.probationEnd, inDays });
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/** Reviews not yet completed for these people. */
export function reviewsOpen(state: DemoState, employeeIds: Set<string>): Review[] {
  return state.reviews.filter((r) => employeeIds.has(r.employeeId) && r.status !== "Completed");
}

export function pendingLeaveFor(state: DemoState, employeeIds: Set<string>): LeaveRequest[] {
  return state.leave.filter((l) => l.status === "Pending" && employeeIds.has(l.employeeId));
}

/** Who has clocked in today (Lagos date), and who is late. */
export function clockedInToday(state: DemoState, employeeIds: Set<string>, nowIso: string): Set<string> {
  const today = lagosDate(nowIso);
  return new Set(state.attendance.filter((a) => a.date === today && employeeIds.has(a.employeeId)).map((a) => a.employeeId));
}
