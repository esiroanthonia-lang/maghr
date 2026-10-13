// Unit tests for employees, leave, performance, payroll and settings logic. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { appReducer } from "../lib/app-reducer";
import { createDemoData } from "../lib/demo-data";
import {
  averageTimeToHire,
  headcountByDepartment,
  isPeopleAction,
  leaveBalance,
  onLeaveOn,
  payrollTotals,
  periodLabel,
  toCsv,
  workingDays,
  type EmployeeInput,
  type PeopleAction,
} from "../lib/people";
import { canPerform, myEmployeeEmail, rolesFor } from "../lib/workspace";

const NOW = new Date("2026-10-12T13:00:00Z");
const at = "2026-10-12T14:00:00.000Z";
const fresh = () => createDemoData(NOW);
const run = (s: ReturnType<typeof fresh>, a: PeopleAction) => appReducer(s, a);

const newHire: EmployeeInput = {
  name: "  Ada Lovelace-Obi ",
  email: "ADA.OBI@example.com",
  phone: "+234 800 000 0000",
  department: "Engineering",
  jobTitle: "Data Engineer",
  location: "Lagos",
  startDate: "2026-11-02",
  managerName: "Tobi Ogun",
  employmentType: "Full-time",
  status: "Onboarding",
};

describe("employees", () => {
  it("adds an employee with tidy fields and optional pay", () => {
    const s = fresh();
    const next = run(s, { type: "employee/add", id: "e-new", at, input: newHire, monthlyGross: 600000.4 });
    const e = next.employees.find((x) => x.id === "e-new")!;
    assert.equal(e.name, "Ada Lovelace-Obi");
    assert.equal(e.email, "ada.obi@example.com");
    assert.equal(e.source, "Added manually");
    assert.equal(next.pay["e-new"], 600000);
    assert.equal(next.activity[0].title, "Employee added");
  });

  it("refuses a duplicate email", () => {
    const s = fresh();
    const dup = { ...newHire, email: "grace.nwosu@example.com" };
    assert.equal(run(s, { type: "employee/add", id: "x", at, input: dup, monthlyGross: null }), s);
  });

  it("records an exit once and excludes exited staff from payroll", () => {
    const s = fresh();
    const before = payrollTotals(s);
    const next = run(s, { type: "employee/exit", id: "x", at, employeeId: "emp-002", date: "2026-10-31" });
    assert.equal(next.employees.find((e) => e.id === "emp-002")!.status, "Exited");
    assert.equal(payrollTotals(next).count, before.count - 1);
    assert.equal(run(next, { type: "employee/exit", id: "y", at, employeeId: "emp-002", date: "2026-11-30" }), next);
  });

  it("edits keep an exited employee exited", () => {
    const s = run(fresh(), { type: "employee/exit", id: "x", at, employeeId: "emp-003", date: "2026-10-31" });
    const e = s.employees.find((x) => x.id === "emp-003")!;
    const next = run(s, { type: "employee/update", id: "u", at, employeeId: e.id, input: { ...newHire, email: e.email, status: "Active" } });
    assert.equal(next.employees.find((x) => x.id === "emp-003")!.status, "Exited");
  });
});

describe("leave", () => {
  it("counts working days only (Mon–Fri)", () => {
    assert.equal(workingDays("2026-10-16", "2026-10-19"), 2); // Fri → Mon
    assert.equal(workingDays("2026-10-12", "2026-10-16"), 5);
    assert.equal(workingDays("2026-10-17", "2026-10-18"), 0); // weekend
    assert.equal(workingDays("2026-10-20", "2026-10-19"), 0); // end before start
  });

  it("requests leave as Pending with computed days, and refuses weekend-only requests", () => {
    const s = fresh();
    const next = run(s, { type: "leave/request", id: "lv-x", at, input: { employeeId: "emp-005", leaveType: "Annual", startDate: "2026-10-19", endDate: "2026-10-23", reason: "Rest" } });
    const l = next.leave[0];
    assert.equal(l.status, "Pending");
    assert.equal(l.days, 5);
    assert.equal(run(s, { type: "leave/request", id: "lv-y", at, input: { employeeId: "emp-005", leaveType: "Annual", startDate: "2026-10-17", endDate: "2026-10-18", reason: "" } }), s);
  });

  it("approves once, records who decided, and updates the balance", () => {
    const s = fresh();
    const year = 2026;
    const before = leaveBalance(s, "emp-001", year);
    const next = run(s, { type: "leave/decide", id: "d", at, by: "Kunle Akande", leaveId: "lv-001", status: "Approved" });
    const l = next.leave.find((x) => x.id === "lv-001")!;
    assert.equal(l.status, "Approved");
    assert.equal(l.decidedBy, "Kunle Akande");
    assert.equal(leaveBalance(next, "emp-001", year).taken, before.taken + l.days);
    assert.equal(run(next, { type: "leave/decide", id: "d2", at, leaveId: "lv-001", status: "Declined" }), next);
  });

  it("finds who is off on a date", () => {
    const s = fresh();
    const today = NOW.toISOString().slice(0, 10);
    const ids = onLeaveOn(s, today).map((l) => l.employeeId).sort();
    assert.deepEqual(ids, ["emp-009", "emp-011"]);
  });

  it("caps remaining balance at zero", () => {
    let s = fresh();
    s = { ...s, settings: { ...s.settings, leaveAllowanceDays: 2 } };
    assert.equal(leaveBalance(s, "emp-002", 2026).remaining, 0); // emp-002 took 8 days
  });
});

describe("performance", () => {
  it("adds goals and clamps progress", () => {
    const s = fresh();
    const a = run(s, { type: "goal/add", id: "g", at, input: { title: "Ship payroll v2", ownerName: "Tobi", department: "Engineering", dueDate: "2026-12-01" } });
    assert.equal(a.goals[0].progress, 0);
    const b = run(a, { type: "goal/progress", id: "p", at, goalId: "g", progress: 150 });
    assert.equal(b.goals.find((g) => g.id === "g")!.progress, 100);
  });

  it("creates or updates one review per employee per cycle", () => {
    const s = fresh();
    const a = run(s, { type: "review/set", id: "r1", at, by: "Tobi Ogun", employeeId: "emp-002", cycle: "Q4 2026", status: "Completed", rating: 9, summary: "Great" });
    const r = a.reviews.filter((x) => x.employeeId === "emp-002" && x.cycle === "Q4 2026");
    assert.equal(r.length, 1);
    assert.equal(r[0].rating, 5);
    assert.equal(r[0].reviewerName, "Tobi Ogun");
  });
});

describe("payroll (preview only)", () => {
  it("prepares a run from current active pay", () => {
    const s = fresh();
    const { count, total } = payrollTotals(s);
    const a = run(s, { type: "payroll/create", id: "pr", at, by: "Grace Nwosu", period: "2026-10" });
    const r = a.payrollRuns.find((x) => x.id === "pr")!;
    assert.equal(r.status, "Draft");
    assert.equal(r.employeeCount, count);
    assert.equal(r.grossTotal, total);
    assert.equal(run(a, { type: "payroll/create", id: "dup", at, period: "2026-10" }), a, "one run per period");
    assert.equal(run(s, { type: "payroll/create", id: "bad", at, period: "2026-13" }), s, "invalid period");
  });

  it("needs a different person to approve (maker-checker)", () => {
    let s = run(fresh(), { type: "payroll/create", id: "pr", at, by: "Grace Nwosu", period: "2026-10" });
    s = run(s, { type: "payroll/submit", id: "sb", at, by: "Grace Nwosu", runId: "pr" });
    assert.equal(s.payrollRuns.find((r) => r.id === "pr")!.status, "Pending approval");
    assert.equal(run(s, { type: "payroll/approve", id: "ap", at, by: "Grace Nwosu", runId: "pr" }), s, "preparer cannot approve");
    const ok = run(s, { type: "payroll/approve", id: "ap", at, by: "Kunle Akande", runId: "pr" });
    const r = ok.payrollRuns.find((x) => x.id === "pr")!;
    assert.equal(r.status, "Approved");
    assert.equal(r.approvedBy, "Kunle Akande");
    assert.equal(run(ok, { type: "payroll/reopen", id: "ro", at, runId: "pr" }), ok, "approved runs are locked");
  });

  it("formats periods", () => {
    assert.equal(periodLabel("2026-10"), "October 2026");
  });
});

describe("settings, reports and permissions", () => {
  it("validates company settings", () => {
    const s = fresh();
    assert.equal(run(s, { type: "settings/update", id: "s", at, settings: { companyName: "X", leaveAllowanceDays: 20 } }), s);
    const ok = run(s, { type: "settings/update", id: "s", at, settings: { companyName: "Acme Nigeria", leaveAllowanceDays: 22 } });
    assert.deepEqual(ok.settings, { companyName: "Acme Nigeria", leaveAllowanceDays: 22 });
  });

  it("summarises headcount and time to hire", () => {
    const s = fresh();
    const total = headcountByDepartment(s).reduce((n, d) => n + d.count, 0);
    assert.equal(total, s.employees.filter((e) => e.status !== "Exited").length);
    assert.ok((averageTimeToHire(s) ?? -1) >= 0);
  });

  it("writes spreadsheet-safe CSV", () => {
    const csv = toCsv([{ name: 'A "B"', note: "=HYPERLINK(1)", n: 3 }]);
    assert.equal(csv, '"name","note","n"\r\n"A ""B""","\'=HYPERLINK(1)","3"');
  });

  it("routes actions and roles correctly", () => {
    assert.ok(isPeopleAction("leave/decide"));
    assert.ok(!isPeopleAction("candidate/moveStage"));
    assert.deepEqual(rolesFor("payroll/approve"), ["hr_admin"]);
    assert.deepEqual(rolesFor("candidate/moveStage"), ["hr_admin", "recruiter"]);
    const manager = { mode: "live" as const, orgId: "o", orgName: "O", me: { userId: "u", name: "M", email: "m@x.co", role: "manager" as const } };
    assert.ok(canPerform(manager, "leave/decide"));
    assert.ok(!canPerform(manager, "employee/setPay"));
    assert.ok(canPerform({ mode: "demo" }, "payroll/approve"));
  });

  it("lets every role request or cancel their own leave, but only HR/managers decide", () => {
    const employee = { mode: "live" as const, orgId: "o", orgName: "O", me: { userId: "u", name: "E", email: "E@X.co", role: "employee" as const } };
    assert.ok(canPerform(employee, "leave/request"));
    assert.ok(canPerform(employee, "leave/cancel"));
    assert.ok(!canPerform(employee, "leave/decide"));
    assert.ok(!canPerform(employee, "candidate/moveStage"));
    assert.equal(myEmployeeEmail(employee), "e@x.co");
    assert.equal(myEmployeeEmail({ mode: "demo" }), "grace.nwosu@example.com");
  });
});

describe("Nigerian public holidays", async () => {
  const { easterSunday, nigeriaFixedHolidays, holidaysBetween } = await import("../lib/holidays");
  const { holidaysForState } = await import("../lib/people");

  it("calculates Easter correctly", () => {
    assert.equal(easterSunday(2026), "2026-04-05");
    assert.equal(easterSunday(2027), "2027-03-28");
    assert.equal(easterSunday(2025), "2025-04-20");
  });

  it("lists the fixed national holidays, including Good Friday and Easter Monday", () => {
    const names = Object.fromEntries(nigeriaFixedHolidays(2026).map((h) => [h.name, h.date]));
    assert.equal(names["Good Friday"], "2026-04-03");
    assert.equal(names["Easter Monday"], "2026-04-06");
    assert.equal(names["Democracy Day"], "2026-06-12");
    assert.equal(names["Independence Day"], "2026-10-01");
    assert.equal(nigeriaFixedHolidays(2026).length, 8);
  });

  it("skips weekends, national and company holidays when counting leave", () => {
    const s = fresh(); // demo has a company holiday on 31 Dec
    const h = holidaysForState(s, "2026-12-21", "2026-12-31");
    assert.equal(h.get("2026-12-25"), "Christmas Day");
    assert.equal(h.get("2026-12-31"), "Company end-of-year day");
    // 9 weekdays, minus Christmas (Fri) and 31 Dec (Thu). Boxing Day is a Saturday.
    assert.equal(workingDays("2026-12-21", "2026-12-31", h), 7);
    const next = run(s, { type: "leave/request", id: "x", at, input: { employeeId: "emp-005", leaveType: "Annual", startDate: "2026-12-21", endDate: "2026-12-31", reason: "" } });
    assert.equal(next.leave[0].days, 7);
  });

  it("refuses a request that only covers holidays", () => {
    const s = fresh();
    assert.equal(run(s, { type: "leave/request", id: "x", at, input: { employeeId: "emp-005", leaveType: "Annual", startDate: "2026-10-01", endDate: "2026-10-01", reason: "" } }), s);
  });

  it("adds and removes company holidays (one per date)", () => {
    const s = fresh();
    const a = run(s, { type: "settings/addHoliday", id: "h1", at, date: "2026-03-20", name: "Eid-el-Fitr" });
    assert.ok(a.holidays.some((h) => h.id === "h1"));
    assert.equal(run(a, { type: "settings/addHoliday", id: "h2", at, date: "2026-03-20", name: "Duplicate" }), a);
    const b = run(a, { type: "settings/removeHoliday", id: "r", at, holidayId: "h1" });
    assert.ok(!b.holidays.some((h) => h.id === "h1"));
    assert.equal(holidaysBetween("2026-03-20", "2026-03-20", b.holidays).size, 0);
  });
});
