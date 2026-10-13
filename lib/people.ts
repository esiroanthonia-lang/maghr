// Pure logic for the people modules: employees, leave, performance, payroll runs, settings.
// Same pattern as lib/recruitment.ts: callers pass ids/timestamps; the database enforces
// the same rules again (see supabase/migrations/20261013000001_people.sql).

import type { DemoState } from "./demo-data";
import { isTime, lagosDate, lagosToIso } from "./attendance";
import { validCareersSettings, type CareersSettings } from "./careers";
import { checkBank, checkJob, checkPersonal, emptyRecord, normaliseBank, normaliseJob, normalisePersonal, type BankDetails, type JobDetails, type PersonalDetails } from "./employee-record";
import { holidaysBetween } from "./holidays";
import { computePayslip, validConfig, type PayrollConfig } from "./paye";
import type {
  CompanySettings,
  Department,
  Employee,
  EmploymentType,
  GoalDepartment,
  LeaveRequest,
  LeaveType,
  OnboardingOwner,
  OnboardingTask,
  PayrollLine,
  PayrollRun,
  ReviewStatus,
  WorkMode,
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
  | ({ type: "employee/exit"; employeeId: string; date: string; reason?: string; checklist?: string[] } & Meta)
  | ({ type: "employee/setRent"; employeeId: string; annualRent: number } & Meta)
  | ({ type: "employee/updatePersonal"; employeeId: string; personal: PersonalDetails } & Meta)
  | ({ type: "employee/updateJob"; employeeId: string; job: JobDetails } & Meta)
  | ({ type: "employee/updateBank"; employeeId: string; bank: BankDetails } & Meta)
  | ({ type: "settings/payroll"; config: PayrollConfig; confirm: boolean } & Meta)
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
  | ({ type: "settings/removeHoliday"; holidayId: string } & Meta)
  | ({ type: "settings/careers"; careers: CareersSettings } & Meta)
  | ({ type: "onboarding/start"; employeeId: string } & Meta)
  | ({ type: "onboarding/add"; employeeId: string; title: string; owner: OnboardingOwner; dueDate: string | null } & Meta)
  | ({ type: "onboarding/toggle"; taskId: string; done: boolean } & Meta)
  | ({ type: "onboarding/remove"; taskId: string } & Meta)
  | ({ type: "attendance/clockIn"; employeeId: string; mode: WorkMode } & Meta)
  | ({ type: "attendance/clockOut"; recordId: string } & Meta)
  | ({ type: "attendance/correct"; recordId: string; clockIn: string; clockOut: string | null } & Meta);

export const PEOPLE_PREFIXES = ["employee/", "leave/", "goal/", "review/", "payroll/", "settings/", "onboarding/", "attendance/"];

// ---------- onboarding ----------

/**
 * A sensible first-weeks checklist for a Nigerian company. Offsets are calendar days from the start date.
 * The checklist only records that a step is done. The numbers themselves (bank account, RSA PIN, TIN)
 * go on the employee's Pay & bank tab, which only HR admins and the person can see.
 */
export const ONBOARDING_TEMPLATE: { title: string; owner: OnboardingOwner; offset: number }[] = [
  { title: "Send offer letter and employment contract", owner: "HR", offset: -10 },
  { title: "Receive signed contract", owner: "HR", offset: -5 },
  { title: "Set up work email, laptop and system access", owner: "Manager", offset: -1 },
  { title: "Collect payroll details (bank account, pension RSA PIN, TIN)", owner: "HR", offset: 0 },
  { title: "Welcome, team introductions and workspace tour", owner: "Manager", offset: 0 },
  { title: "Submit ID, guarantor forms and emergency contact", owner: "New hire", offset: 5 },
  { title: "Read and acknowledge the employee handbook", owner: "New hire", offset: 5 },
  { title: "Agree 30/60/90-day goals", owner: "Manager", offset: 10 },
  { title: "First-month check-in", owner: "Manager", offset: 30 },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Ids for tasks created together: keeps UUIDs valid so the database can store the same id. */
export function derivedId(base: string, i: number): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)
    ? base.slice(0, -4) + i.toString(16).padStart(4, "0")
    : `${base}-${i}`;
}

export function onboardingTemplate(employeeId: string, startDate: string, baseId: string): OnboardingTask[] {
  const valid = ISO_DATE.test(startDate);
  return ONBOARDING_TEMPLATE.map((t, i) => ({
    id: derivedId(baseId, i),
    employeeId,
    title: t.title,
    owner: t.owner,
    dueDate: valid ? addDays(startDate, t.offset) : null,
    doneAt: null,
    doneBy: "",
    position: i,
  }));
}

export function onboardingFor(state: State, employeeId: string): OnboardingTask[] {
  return state.onboarding.filter((t) => t.employeeId === employeeId).sort((a, b) => a.position - b.position);
}

export function onboardingProgress(state: State, employeeId: string): { done: number; total: number } {
  const tasks = state.onboarding.filter((t) => t.employeeId === employeeId);
  return { done: tasks.filter((t) => t.doneAt).length, total: tasks.length };
}

/** Open onboarding steps that are due on or before a date, across everyone. */
export function overdueOnboarding(state: State, isoDate: string): OnboardingTask[] {
  const live = new Set(state.employees.filter((e) => e.status !== "Exited").map((e) => e.id));
  return state.onboarding.filter((t) => !t.doneAt && t.dueDate && t.dueDate <= isoDate && live.has(t.employeeId));
}
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
      const employee: Employee = { id: action.id, ...e, source: "Added manually", exitedOn: null, exitReason: "", exitChecklist: [] };
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
    case "employee/setRent": {
      if (!state.employees.some((e) => e.id === action.employeeId) || !(action.annualRent >= 0 && action.annualRent < 1e10)) return state;
      return { ...state, rent: { ...state.rent, [action.employeeId]: Math.round(action.annualRent) } };
    }
    case "employee/updatePersonal": {
      if (!state.employees.some((e) => e.id === action.employeeId)) return state;
      const personal = normalisePersonal(action.personal);
      if (Object.keys(checkPersonal(personal, action.at.slice(0, 10))).length) return state;
      const current = state.records[action.employeeId] ?? emptyRecord();
      return { ...state, records: { ...state.records, [action.employeeId]: { ...current, personal } } };
    }
    case "employee/updateJob": {
      if (!state.employees.some((e) => e.id === action.employeeId)) return state;
      const job = normaliseJob(action.job);
      if (Object.keys(checkJob(job)).length) return state;
      if (job.staffId && Object.entries(state.records).some(([id, r]) => id !== action.employeeId && r.job.staffId.toLowerCase() === job.staffId.toLowerCase())) return state;
      const current = state.records[action.employeeId] ?? emptyRecord();
      return { ...state, records: { ...state.records, [action.employeeId]: { ...current, job } } };
    }
    case "employee/updateBank": {
      if (!state.employees.some((e) => e.id === action.employeeId)) return state;
      const bank = normaliseBank(action.bank);
      if (Object.keys(checkBank(bank)).length) return state;
      return {
        ...state,
        bank: { ...state.bank, [action.employeeId]: bank },
        activity: log(state, action.id, action.at, "employee", "Bank or statutory details updated", nameOf(state, action.employeeId)),
      };
    }
    case "employee/exit": {
      const e = state.employees.find((x) => x.id === action.employeeId);
      const reason = action.reason ?? "Resignation";
      if (!e || !ISO_DATE.test(action.date) || !["Resignation", "Termination", "Contract ended", "Retirement", "Other"].includes(reason)) return state;
      const checklist = [...new Set(action.checklist ?? [])].filter((id) => ["handover", "property", "access", "pay", "interview", "documents"].includes(id));
      return {
        ...state,
        employees: state.employees.map((x) => (x.id === e.id ? { ...x, status: "Exited", exitedOn: action.date, exitReason: reason, exitChecklist: checklist } : x)),
        activity: log(state, action.id, action.at, "employee", e.status === "Exited" ? "Exit checklist updated" : "Employee exit recorded", `${e.name} · last day ${action.date} · ${reason}`),
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
        ...runTotals(computeRunLines(state, action.id)),
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
      // Payslips and totals are worked out from current pay at the moment of submission, then locked.
      const { count, total } = payrollTotals(state);
      const lines = computeRunLines(state, run.id, action.id);
      return {
        ...state,
        payrollLines: [...state.payrollLines.filter((l) => l.runId !== run.id), ...lines],
        payrollRuns: state.payrollRuns.map((r) =>
          r.id === run.id ? { ...r, status: "Pending approval", employeeCount: count, grossTotal: total, ...runTotals(lines) } : r,
        ),
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
      return {
        ...state,
        payrollRuns: state.payrollRuns.map((r) => (r.id === run.id ? { ...r, status: "Draft" } : r)),
        payrollLines: state.payrollLines.filter((l) => l.runId !== run.id),
      };
    }

    case "settings/update": {
      const name = action.settings.companyName.trim();
      const days = Math.round(action.settings.leaveAllowanceDays);
      const workStart = action.settings.workStart ?? state.settings.workStart;
      if (name.length < 2 || !(days >= 0 && days <= 60) || !isTime(workStart)) return state;
      return {
        ...state,
        settings: { companyName: name, leaveAllowanceDays: days, workStart },
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
    case "settings/payroll": {
      if (!validConfig(action.config)) return state;
      const rates = (c: PayrollConfig) => JSON.stringify({ ...c, confirmedBy: "", confirmedAt: null });
      const changed = rates(action.config) !== rates(state.payrollConfig);
      // Any change to the rules needs confirming again; confirming records who and when.
      const confirmedBy = action.confirm ? by : changed ? "" : state.payrollConfig.confirmedBy;
      const confirmedAt = action.confirm ? action.at : changed ? null : state.payrollConfig.confirmedAt;
      return {
        ...state,
        payrollConfig: { ...action.config, confirmedBy, confirmedAt },
        activity: log(state, action.id, action.at, "payroll", action.confirm ? "Payroll rules confirmed" : "Payroll rules updated", action.confirm ? `by ${by}` : ""),
      };
    }
    case "settings/careers": {
      const next = { enabled: Boolean(action.careers.enabled), slug: action.careers.slug.trim().toLowerCase(), intro: action.careers.intro.trim() };
      if (!validCareersSettings(next)) return state;
      return {
        ...state,
        careers: next,
        activity:
          next.enabled !== state.careers.enabled
            ? log(state, action.id, action.at, "settings", next.enabled ? "Careers page turned on" : "Careers page turned off", next.enabled ? `/careers/${next.slug}` : "")
            : state.activity,
      };
    }
    case "settings/removeHoliday": {
      if (!state.holidays.some((h) => h.id === action.holidayId)) return state;
      return { ...state, holidays: state.holidays.filter((h) => h.id !== action.holidayId) };
    }

    case "onboarding/start": {
      const emp = state.employees.find((e) => e.id === action.employeeId);
      if (!emp || emp.status === "Exited" || state.onboarding.some((t) => t.employeeId === emp.id)) return state;
      return {
        ...state,
        onboarding: [...state.onboarding, ...onboardingTemplate(emp.id, emp.startDate, action.id)],
        activity: log(state, action.id, action.at, "employee", "Onboarding started", `${emp.name} · starts ${emp.startDate}`),
      };
    }
    case "onboarding/add": {
      const emp = state.employees.find((e) => e.id === action.employeeId);
      const title = action.title.trim();
      if (!emp || emp.status === "Exited" || title.length < 3 || title.length > 160) return state;
      if (action.dueDate !== null && !ISO_DATE.test(action.dueDate)) return state;
      const position = Math.max(-1, ...state.onboarding.filter((t) => t.employeeId === emp.id).map((t) => t.position)) + 1;
      return {
        ...state,
        onboarding: [...state.onboarding, { id: action.id, employeeId: emp.id, title, owner: action.owner, dueDate: action.dueDate, doneAt: null, doneBy: "", position }],
      };
    }
    case "onboarding/toggle": {
      const task = state.onboarding.find((t) => t.id === action.taskId);
      if (!task || Boolean(task.doneAt) === action.done) return state;
      const next = state.onboarding.map((t) => (t.id === task.id ? { ...t, doneAt: action.done ? action.at : null, doneBy: action.done ? by : "" } : t));
      const tasks = next.filter((t) => t.employeeId === task.employeeId);
      const finished = action.done && tasks.every((t) => t.doneAt);
      return {
        ...state,
        onboarding: next,
        activity: finished ? log(state, action.id, action.at, "employee", "Onboarding complete", nameOf(state, task.employeeId)) : state.activity,
      };
    }
    case "attendance/clockIn": {
      const emp = state.employees.find((e) => e.id === action.employeeId);
      const date = lagosDate(action.at);
      if (!emp || emp.status === "Exited" || state.attendance.some((r) => r.employeeId === emp.id && r.date === date)) return state;
      return {
        ...state,
        attendance: [...state.attendance, { id: action.id, employeeId: emp.id, date, clockIn: action.at, clockOut: null, mode: action.mode, correctedBy: "", correctedAt: null }],
      };
    }
    case "attendance/clockOut": {
      const rec = state.attendance.find((r) => r.id === action.recordId);
      if (!rec || rec.clockOut || Date.parse(action.at) <= Date.parse(rec.clockIn)) return state;
      return { ...state, attendance: state.attendance.map((r) => (r.id === rec.id ? { ...r, clockOut: action.at } : r)) };
    }
    case "attendance/correct": {
      const rec = state.attendance.find((r) => r.id === action.recordId);
      if (!rec || !isTime(action.clockIn) || (action.clockOut !== null && (!isTime(action.clockOut) || action.clockOut <= action.clockIn))) return state;
      const clockIn = lagosToIso(rec.date, action.clockIn);
      const clockOut = action.clockOut === null ? null : lagosToIso(rec.date, action.clockOut);
      return {
        ...state,
        attendance: state.attendance.map((r) => (r.id === rec.id ? { ...r, clockIn, clockOut, correctedBy: by, correctedAt: action.at } : r)),
        activity: log(state, action.id, action.at, "employee", "Attendance corrected", `${nameOf(state, rec.employeeId)} · ${rec.date}`),
      };
    }
    case "onboarding/remove": {
      if (!state.onboarding.some((t) => t.id === action.taskId)) return state;
      return { ...state, onboarding: state.onboarding.filter((t) => t.id !== action.taskId) };
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

/** Payslips for everyone with pay set, from current pay and the company's payroll rules. */
export function computeRunLines(state: State, runId: string, idBase = runId): PayrollLine[] {
  return activeEmployees(state)
    .filter((e) => typeof state.pay[e.id] === "number" && state.pay[e.id] > 0)
    .map((e, i) => {
      const p = computePayslip(state.pay[e.id], state.rent[e.id] ?? 0, state.payrollConfig);
      return {
        id: derivedId(idBase, i),
        runId,
        employeeId: e.id,
        employeeName: e.name,
        gross: p.monthlyGross,
        basic: p.basic,
        housing: p.housing,
        transport: p.transport,
        other: p.other,
        pension: p.pension,
        nhf: p.nhf,
        paye: p.paye,
        net: p.net,
        employerPension: p.employerPension,
        rentRelief: p.annualRentRelief,
        taxable: p.annualTaxable,
      };
    });
}

export function runTotals(lines: PayrollLine[]) {
  const sum = (k: keyof PayrollLine) => Math.round(lines.reduce((n, l) => n + (l[k] as number), 0) * 100) / 100;
  return { payeTotal: sum("paye"), pensionTotal: sum("pension"), nhfTotal: sum("nhf"), netTotal: sum("net"), employerPensionTotal: sum("employerPension") };
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
