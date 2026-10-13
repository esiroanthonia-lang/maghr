// Pure logic for the people modules: employees, leave, performance, payroll runs, settings.
// Same pattern as lib/recruitment.ts: callers pass ids/timestamps; the database enforces
// the same rules again (see supabase/migrations/20261013000001_people.sql).

import type { DemoState } from "./demo-data";
import { holidaysBetween } from "./holidays";
import type {
  CompanySettings,
  Department,
  Employee,
  EmploymentType,
  GoalDepartment,
  LeaveRequest,
  LeaveType,
  PayrollRun,
  ReviewStatus,
} from "./types";

type State = DemoState;

interface Meta {
  id: string;
  at: string;
  by?: string;
}

export interface EmployeeInput {
  name: string;
  email: string;
  phone: string;
  department: Department;
  jobTitle: string;
  location: string;
  startDate: string;
  managerName: string;
  employmentType: EmploymentType;
  status: "Active" | "Onboarding";
}

export interface LeaveInput {
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface GoalInput {
  title: string;
  ownerName: string;
  department: GoalDepartment;
  dueDate: string;
}

export type PeopleAction =
  | ({ type: "employee/add"; input: EmployeeInput; monthlyGross: number | null } & Meta)
  | ({ type: "employee/update"; employeeId: string; input: EmployeeInput } & Meta)
  | ({ type: "employee/setPay"; employeeId: string; monthlyGross: number } & Meta)
  | ({ type: "employee/exit"; employeeId: string; date: string } & Meta)
  | ({ type: "leave/request"; input: LeaveInput } & Meta)
  | ({ type: "leave/decide"; leaveId: string; status: "Approved" | "Declined" } & Meta)
  | ({ type: "leave/cancel"; leaveId: string } & Meta)
  | ({ type: "goal/add"; input: GoalInput } & Meta)
  | ({ type: "goal/progress"; goalId: string; progress: number } & Meta)
  | ({ type: "review/set"; employeeId: string; cycle: string; status: ReviewStatus; rating: number | null; summary: string } & Meta)
  | ({ type: "payroll/create"; period: string } & Meta)
  | ({ type: "payroll/submit"; runId: string } & Meta)
  | ({ type: "payroll/approve"; runId: string } & Meta)
  | ({ type: "payroll/reopen"; runId: string } & Meta)
  | ({ type: "settings/update"; settings: CompanySettings } & Meta)
  | ({ type: "settings/addHoliday"; date: string; name: string } & Meta)
  | ({ type: "settings/removeHoliday"; holidayId: string } & Meta);

export const PEOPLE_PREFIXES = ["employee/", "leave/", "goal/", "review/", "payroll/", "settings/"];
export const isPeopleAction = (type: string) => PEOPLE_PREFIXES.some((p) => type.startsWith(p));

// ---------- helpers ----------

const DAY = 86_400_000;

/**
 * Working days (Mon–Fri) between two YYYY-MM-DD dates, inclusive, minus any holidays given.
 * Pass holidays from holidaysForState() so Nigerian public and company holidays are skipped.
 */
export function workingDays(start: string, end: string, holidays: ReadonlySet<string> | Map<string, string> = new Set()): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a || b - a > 400 * DAY) return 0;
  let n = 0;
  for (let t = a; t <= b; t += DAY) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6 && !holidays.has(new Date(t).toISOString().slice(0, 10))) n++;
  }
  return n;
}

/** National + company holidays between two dates, for this workspace. */
export function holidaysForState(state: State, start: string, end: string): Map<string, string> {
  return holidaysBetween(start, end, state.holidays);
}

export function isValidPeriod(p: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

function log(state: State, id: string, at: string, kind: State["activity"][number]["kind"], title: string, detail: string) {
  return [{ id: `act-${id}`, kind, title, detail, at }, ...state.activity].slice(0, 50);
}

const nameOf = (state: State, employeeId: string) => state.employees.find((e) => e.id === employeeId)?.name ?? "Unknown";

function cleanEmployee(input: EmployeeInput) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    department: input.department,
    jobTitle: input.jobTitle.trim(),
    location: input.location.trim(),
    startDate: input.startDate,
    managerName: input.managerName.trim(),
    employmentType: input.employmentType,
    status: input.status,
  };
}

// ---------- reducer ----------

export function peopleReducer(state: State, action: PeopleAction): State {
  const by = action.by ?? "HR Admin";
  switch (action.type) {
    case "employee/add": {
      const e = cleanEmployee(action.input);
      if (state.employees.some((x) => x.email === e.email)) return state;
      const employee: Employee = { id: action.id, ...e, source: "Added manually", exitedOn: null };
      const pay = { ...state.pay };
      if (action.monthlyGross !== null && action.monthlyGross >= 0) pay[action.id] = Math.round(action.monthlyGross);
      return {
        ...state,
        employees: [...state.employees, employee].sort((a, b) => a.name.localeCompare(b.name)),
        pay,
        activity: log(state, action.id, action.at, "employee", "Employee added", `${employee.name} · ${employee.jobTitle}`),
      };
    }
    case "employee/update": {
      const current = state.employees.find((e) => e.id === action.employeeId);
      if (!current) return state;
      const e = cleanEmployee(action.input);
      if (state.employees.some((x) => x.id !== current.id && x.email === e.email)) return state;
      return {
        ...state,
        employees: state.employees.map((x) =>
          x.id === current.id ? { ...x, ...e, status: x.status === "Exited" ? "Exited" : e.status } : x,
        ),
      };
    }
    case "employee/setPay": {
      if (!state.employees.some((e) => e.id === action.employeeId) || !(action.monthlyGross >= 0)) return state;
      return { ...state, pay: { ...state.pay, [action.employeeId]: Math.round(action.monthlyGross) } };
    }
    case "employee/exit": {
      const e = state.employees.find((x) => x.id === action.employeeId);
      if (!e || e.status === "Exited") return state;
      return {
        ...state,
        employees: state.employees.map((x) => (x.id === e.id ? { ...x, status: "Exited", exitedOn: action.date } : x)),
        activity: log(state, action.id, action.at, "employee", "Employee exit recorded", `${e.name} · last day ${action.date}`),
      };
    }

    case "leave/request": {
      const { input } = action;
      const emp = state.employees.find((e) => e.id === input.employeeId);
      const days = workingDays(input.startDate, input.endDate, holidaysForState(state, input.startDate, input.endDate));
      if (!emp || emp.status === "Exited" || days < 1 || days > 120) return state;
      const req: LeaveRequest = {
        id: action.id,
        employeeId: emp.id,
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        reason: input.reason.trim().slice(0, 1000),
        status: "Pending",
        decidedBy: "",
        decidedAt: null,
        createdAt: action.at,
      };
      return {
        ...state,
        leave: [req, ...state.leave],
        activity: log(state, action.id, action.at, "leave", "Leave requested", `${emp.name} · ${input.leaveType} · ${days} day${days === 1 ? "" : "s"}`),
      };
    }
    case "leave/decide": {
      const req = state.leave.find((l) => l.id === action.leaveId);
      if (!req || req.status !== "Pending") return state;
      return {
        ...state,
        leave: state.leave.map((l) => (l.id === req.id ? { ...l, status: action.status, decidedBy: by, decidedAt: action.at } : l)),
        activity: log(state, action.id, action.at, "leave", `Leave ${action.status.toLowerCase()}`, `${nameOf(state, req.employeeId)} · ${req.leaveType} · ${req.days} day${req.days === 1 ? "" : "s"}`),
      };
    }
    case "leave/cancel": {
      const req = state.leave.find((l) => l.id === action.leaveId);
      if (!req || req.status !== "Pending") return state;
      return { ...state, leave: state.leave.map((l) => (l.id === req.id ? { ...l, status: "Cancelled" } : l)) };
    }

    case "goal/add": {
      const title = action.input.title.trim();
      if (title.length < 3 || !action.input.ownerName.trim() || !action.input.dueDate) return state;
      return {
        ...state,
        goals: [{ id: action.id, title, ownerName: action.input.ownerName.trim(), department: action.input.department, dueDate: action.input.dueDate, progress: 0, createdAt: action.at }, ...state.goals],
        activity: log(state, action.id, action.at, "performance", "Goal created", `${title} · ${action.input.ownerName.trim()}`),
      };
    }
    case "goal/progress": {
      const p = Math.max(0, Math.min(100, Math.round(action.progress)));
      if (!state.goals.some((g) => g.id === action.goalId)) return state;
      return { ...state, goals: state.goals.map((g) => (g.id === action.goalId ? { ...g, progress: p } : g)) };
    }

    case "review/set": {
      if (!state.employees.some((e) => e.id === action.employeeId)) return state;
      const rating = action.rating === null ? null : Math.max(1, Math.min(5, Math.round(action.rating)));
      const existing = state.reviews.find((r) => r.employeeId === action.employeeId && r.cycle === action.cycle);
      const next = {
        id: existing?.id ?? action.id,
        employeeId: action.employeeId,
        cycle: action.cycle,
        status: action.status,
        rating,
        summary: action.summary.trim().slice(0, 2000),
        reviewerName: by,
        updatedAt: action.at,
      };
      return {
        ...state,
        reviews: existing ? state.reviews.map((r) => (r.id === existing.id ? next : r)) : [...state.reviews, next],
        activity:
          action.status === "Completed" && existing?.status !== "Completed"
            ? log(state, action.id, action.at, "performance", "Review completed", `${nameOf(state, action.employeeId)} · ${action.cycle}`)
            : state.activity,
      };
    }

    case "payroll/create": {
      if (!isValidPeriod(action.period) || state.payrollRuns.some((r) => r.period === action.period)) return state;
      const { count, total } = payrollTotals(state);
      const run: PayrollRun = {
        id: action.id,
        period: action.period,
        status: "Draft",
        employeeCount: count,
        grossTotal: total,
        preparedBy: by,
        approvedBy: "",
        approvedAt: null,
        createdAt: action.at,
      };
      return {
        ...state,
        payrollRuns: [run, ...state.payrollRuns].sort((a, b) => b.period.localeCompare(a.period)),
        activity: log(state, action.id, action.at, "payroll", "Payroll run prepared", `${periodLabel(action.period)} · ${count} people`),
      };
    }
    case "payroll/submit": {
      const run = state.payrollRuns.find((r) => r.id === action.runId);
      if (!run || run.status !== "Draft") return state;
      // Totals are refreshed from current pay at the moment of submission, then locked.
      const { count, total } = payrollTotals(state);
      return {
        ...state,
        payrollRuns: state.payrollRuns.map((r) => (r.id === run.id ? { ...r, status: "Pending approval", employeeCount: count, grossTotal: total } : r)),
        activity: log(state, action.id, action.at, "payroll", "Payroll submitted for approval", periodLabel(run.period)),
      };
    }
    case "payroll/approve": {
      const run = state.payrollRuns.find((r) => r.id === action.runId);
      // Maker-checker: the person who prepared the run cannot approve it.
      if (!run || run.status !== "Pending approval" || run.preparedBy === by) return state;
      return {
        ...state,
        payrollRuns: state.payrollRuns.map((r) => (r.id === run.id ? { ...r, status: "Approved", approvedBy: by, approvedAt: action.at } : r)),
        activity: log(state, action.id, action.at, "payroll", "Payroll approved", `${periodLabel(run.period)} · by ${by}`),
      };
    }
    case "payroll/reopen": {
      const run = state.payrollRuns.find((r) => r.id === action.runId);
      if (!run || run.status !== "Pending approval") return state;
      return { ...state, payrollRuns: state.payrollRuns.map((r) => (r.id === run.id ? { ...r, status: "Draft" } : r)) };
    }

    case "settings/update": {
      const name = action.settings.companyName.trim();
      const days = Math.round(action.settings.leaveAllowanceDays);
      if (name.length < 2 || !(days >= 0 && days <= 60)) return state;
      return {
        ...state,
        settings: { companyName: name, leaveAllowanceDays: days },
        activity: log(state, action.id, action.at, "settings", "Company settings updated", name),
      };
    }
    case "settings/addHoliday": {
      const name = action.name.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(action.date) || name.length < 2 || name.length > 80) return state;
      if (state.holidays.some((h) => h.date === action.date)) return state;
      return {
        ...state,
        holidays: [...state.holidays, { id: action.id, date: action.date, name }].sort((a, b) => a.date.localeCompare(b.date)),
        activity: log(state, action.id, action.at, "settings", "Holiday added", `${name} · ${action.date}`),
      };
    }
    case "settings/removeHoliday": {
      if (!state.holidays.some((h) => h.id === action.holidayId)) return state;
      return { ...state, holidays: state.holidays.filter((h) => h.id !== action.holidayId) };
    }
    default:
      return state;
  }
}

// ---------- selectors ----------

export function activeEmployees(state: State): Employee[] {
  return state.employees.filter((e) => e.status !== "Exited");
}

export function payrollTotals(state: State): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const e of activeEmployees(state)) {
    const p = state.pay[e.id];
    if (typeof p === "number" && p > 0) {
      count++;
      total += p;
    }
  }
  return { count, total };
}

/** Annual leave taken (approved) in a calendar year, and what's left of the allowance. */
export function leaveBalance(state: State, employeeId: string, year: number) {
  const taken = state.leave
    .filter((l) => l.employeeId === employeeId && l.leaveType === "Annual" && l.status === "Approved" && l.startDate.startsWith(String(year)))
    .reduce((n, l) => n + l.days, 0);
  const pending = state.leave
    .filter((l) => l.employeeId === employeeId && l.leaveType === "Annual" && l.status === "Pending" && l.startDate.startsWith(String(year)))
    .reduce((n, l) => n + l.days, 0);
  const allowance = state.settings.leaveAllowanceDays;
  return { allowance, taken, pending, remaining: Math.max(0, allowance - taken) };
}

export function onLeaveOn(state: State, isoDate: string): LeaveRequest[] {
  return state.leave.filter((l) => l.status === "Approved" && l.startDate <= isoDate && l.endDate >= isoDate);
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function formatNaira(n: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

export function headcountByDepartment(state: State): { department: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of activeEmployees(state)) map.set(e.department, (map.get(e.department) ?? 0) + 1);
  return [...map.entries()].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count);
}

/** Average days from application to Hired, for candidates hired so far. */
export function averageTimeToHire(state: State): number | null {
  const days = state.candidates
    .map((c) => {
      const hired = c.stageHistory.find((h) => h.to === "Hired");
      return hired ? (Date.parse(hired.at) - Date.parse(c.createdAt)) / DAY : null;
    })
    .filter((d): d is number => d !== null && d >= 0);
  if (!days.length) return null;
  return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
}

/** CSV with every value quoted, and formula-like values neutralised for spreadsheet safety. */
export function toCsv(rows: Record<string, string | number | null>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const cell = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers.map(cell).join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\r\n");
}
