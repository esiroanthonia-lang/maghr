// Role dashboards: who sees which pages, and the numbers behind each dashboard. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { clockedInToday, daysUntilAnniversary, pendingLeaveFor, probationEnding, reviewsOpen, teamOf, upcomingMoments } from "../lib/dashboard";
import { createDemoData } from "../lib/demo-data";
import { navFor } from "../lib/nav";
import { canOpen, DEMO_PERSONAS, ROLE_PAGES } from "../lib/roles";
import { canPerform, myEmployeeEmail, ROLES, type Role } from "../lib/workspace";

const NOW = new Date("2026-10-12T13:00:00Z");
const fresh = () => createDemoData(NOW);

describe("role pages and menus", () => {
  it("gives every role a home page and keeps menus inside the role's pages", () => {
    for (const role of ROLES) {
      assert.ok(canOpen(role, "/"));
      const { workspace, manage } = navFor(role, false);
      for (const n of [...workspace, ...manage]) assert.ok(ROLE_PAGES[role].includes(n.href), `${role} menu has ${n.href}`);
    }
  });

  it("keeps pay, other people's records and hiring away from the wrong roles", () => {
    assert.ok(!canOpen("employee", "/payroll"));
    assert.ok(!canOpen("employee", "/employees"));
    assert.ok(!canOpen("manager", "/payroll"));
    assert.ok(!canOpen("manager", "/recruitment"));
    assert.ok(!canOpen("recruiter", "/payroll"));
    assert.ok(!canOpen("recruiter", "/leave"));
    assert.ok(canOpen("hr_admin", "/payroll"));
    assert.ok(canOpen("hr_admin", "/employees/emp-001"));
    assert.ok(!canOpen("employee", "/employees/emp-001"));
    assert.ok(canOpen("manager", "/team"));
    assert.ok(!canOpen("hr_admin", "/team"));
  });

  it("names the home page for each role and hides the WhatsApp simulator in live mode", () => {
    assert.equal(navFor("hr_admin", false).workspace[0].label, "People overview");
    assert.equal(navFor("recruiter", false).workspace[0].label, "Hiring desk");
    assert.equal(navFor("manager", false).workspace[0].label, "Team overview");
    assert.deepEqual(navFor("employee", false).workspace.map((n) => n.href), ["/me"]);
    assert.ok(navFor("recruiter", false).workspace.some((n) => n.href === "/whatsapp"));
    assert.ok(!navFor("recruiter", true).workspace.some((n) => n.href === "/whatsapp"));
  });

  it("limits what each demo role can change", () => {
    const demo = { mode: "demo" } as const;
    assert.ok(canPerform(demo, "payroll/create", "hr_admin"));
    assert.ok(!canPerform(demo, "payroll/create", "manager"));
    assert.ok(!canPerform(demo, "candidate/moveStage", "employee"));
    assert.ok(canPerform(demo, "candidate/moveStage", "recruiter"));
    assert.ok(canPerform(demo, "leave/decide", "manager"));
    assert.ok(canPerform(demo, "leave/request", "employee"));
  });

  it("maps each demo role to a real person in the demo staff list", () => {
    const state = fresh();
    for (const role of ROLES as readonly Role[]) {
      const email = myEmployeeEmail({ mode: "demo" }, role);
      assert.equal(email, DEMO_PERSONAS[role]);
      assert.ok(state.employees.some((e) => e.email === email), `${role} persona exists`);
    }
  });
});

describe("dashboard numbers", () => {
  it("finds a manager's direct reports, never exited staff", () => {
    const state = fresh();
    const team = teamOf(state, "Tobi Ogun").map((e) => e.name).sort();
    assert.deepEqual(team, ["Chiamaka Obi", "Daniel Adebayo", "Uche Okeke"]);
    assert.deepEqual(teamOf(state, ""), []);
    assert.deepEqual(teamOf(state, "Nobody Here"), []);
    assert.ok(teamOf(state, "Ifeoma Obi").every((e) => e.status !== "Exited"));
  });

  it("counts days to the next birthday or anniversary, wrapping the year", () => {
    assert.equal(daysUntilAnniversary("1990-10-12", "2026-10-12"), 0);
    assert.equal(daysUntilAnniversary("1990-10-14", "2026-10-12"), 2);
    assert.equal(daysUntilAnniversary("1990-10-11", "2026-10-12"), 364);
    assert.equal(daysUntilAnniversary("1990-01-02", "2026-12-30"), 3);
  });

  it("lists work anniversaries with the right number of years", () => {
    const state = fresh();
    state.employees[1] = { ...state.employees[1], startDate: "2023-10-16" };
    const m = upcomingMoments(state, "2026-10-12", 14).find((x) => x.employeeId === state.employees[1].id && x.kind === "Work anniversary");
    assert.ok(m);
    assert.equal(m.inDays, 4);
    assert.equal(m.years, 3);
  });

  it("does not list a first-year starter as an anniversary", () => {
    const state = fresh();
    state.employees[1] = { ...state.employees[1], startDate: "2026-10-14" };
    assert.ok(!upcomingMoments(state, "2026-10-12", 14).some((x) => x.employeeId === state.employees[1].id && x.kind === "Work anniversary"));
  });

  it("limits moments to the people asked for", () => {
    const state = fresh();
    const ids = new Set([state.employees[0].id]);
    assert.ok(upcomingMoments(state, "2026-10-12", 366, ids).every((m) => ids.has(m.employeeId)));
  });

  it("finds probation ends that are due and unconfirmed", () => {
    const state = fresh();
    const e = state.employees[1];
    state.records[e.id] = { ...state.records[e.id], job: { ...state.records[e.id].job, probationEnd: "2026-10-20", confirmedOn: "" } };
    assert.ok(probationEnding(state, "2026-10-12", 30).some((p) => p.employee.id === e.id && p.inDays === 8));
    state.records[e.id] = { ...state.records[e.id], job: { ...state.records[e.id].job, confirmedOn: "2026-10-01" } };
    assert.ok(!probationEnding(state, "2026-10-12", 30).some((p) => p.employee.id === e.id));
  });

  it("scopes open reviews and pending leave to the team", () => {
    const state = fresh();
    const ids = new Set(teamOf(state, "Tobi Ogun").map((e) => e.id));
    assert.ok(reviewsOpen(state, ids).every((r) => ids.has(r.employeeId) && r.status !== "Completed"));
    assert.ok(pendingLeaveFor(state, ids).every((l) => ids.has(l.employeeId) && l.status === "Pending"));
  });

  it("counts who clocked in today in Lagos time", () => {
    const state = fresh();
    const e = state.employees[1];
    state.attendance = [{ id: "a1", employeeId: e.id, date: "2026-10-12", clockIn: "2026-10-12T07:30:00.000Z", clockOut: null, mode: "Office", correctedBy: "", correctedAt: null }];
    const got = clockedInToday(state, new Set([e.id, state.employees[2].id]), "2026-10-12T10:00:00.000Z");
    assert.deepEqual([...got], [e.id]);
    assert.equal(clockedInToday(state, new Set([e.id]), "2026-10-13T10:00:00.000Z").size, 0);
  });
});
