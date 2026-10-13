// Unit tests for onboarding checklists and the notifications centre. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { appReducer } from "../lib/app-reducer";
import { createDemoData } from "../lib/demo-data";
import { notificationsFor } from "../lib/notifications";
import { derivedId, onboardingFor, onboardingProgress, onboardingTemplate, ONBOARDING_TEMPLATE, overdueOnboarding, type PeopleAction } from "../lib/people";
import { canPerform, rolesFor, type Role, type WorkspaceInfo } from "../lib/workspace";

const NOW = new Date("2026-10-12T13:00:00Z");
const at = "2026-10-12T14:00:00.000Z";
const fresh = () => createDemoData(NOW);
const run = (s: ReturnType<typeof fresh>, a: PeopleAction) => appReducer(s, a);
const live = (role: Role, email = "x@example.com", name = "Someone"): WorkspaceInfo => ({
  mode: "live",
  orgId: "o",
  orgName: "Acme",
  me: { userId: "u", name, email, role },
});

describe("onboarding checklists", () => {
  it("seeds a checklist for the demo new starter with two steps done", () => {
    const s = fresh();
    const kemi = s.employees.find((e) => e.status === "Onboarding")!;
    assert.deepEqual(onboardingProgress(s, kemi.id), { done: 2, total: ONBOARDING_TEMPLATE.length });
  });

  it("builds due dates from the start date and keeps UUID ids valid", () => {
    const tasks = onboardingTemplate("e1", "2026-11-02", "123e4567-e89b-42d3-a456-426614174000");
    assert.equal(tasks[0].dueDate, "2026-10-23"); // 10 days before
    assert.equal(tasks.find((t) => t.title.startsWith("First-month"))!.dueDate, "2026-12-02");
    assert.ok(tasks.every((t) => /^[0-9a-f-]{36}$/.test(t.id)));
    assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length);
    assert.equal(derivedId("onb-1", 3), "onb-1-3");
  });

  it("starts once per person, never for someone who has left", () => {
    let s = fresh();
    const emp = s.employees.find((e) => e.status === "Active")!;
    s = run(s, { type: "onboarding/start", employeeId: emp.id, id: "o1", at });
    assert.equal(onboardingFor(s, emp.id).length, ONBOARDING_TEMPLATE.length);
    assert.equal(run(s, { type: "onboarding/start", employeeId: emp.id, id: "o2", at }), s);
    const exited = s.employees.find((e) => e.status === "Exited")!;
    const t = fresh();
    assert.equal(run(t, { type: "onboarding/start", employeeId: exited.id, id: "o3", at }), t);
  });

  it("ticks, unticks, adds and removes steps, and logs completion", () => {
    let s = fresh();
    const kemi = s.employees.find((e) => e.status === "Onboarding")!;
    const open = onboardingFor(s, kemi.id).filter((t) => !t.doneAt);
    for (const t of open) s = run(s, { type: "onboarding/toggle", taskId: t.id, done: true, id: `x-${t.id}`, at, by: "Grace Nwosu" });
    assert.deepEqual(onboardingProgress(s, kemi.id), { done: ONBOARDING_TEMPLATE.length, total: ONBOARDING_TEMPLATE.length });
    assert.equal(s.activity[0].title, "Onboarding complete");
    assert.equal(onboardingFor(s, kemi.id).at(-1)!.doneBy, "Grace Nwosu");
    s = run(s, { type: "onboarding/toggle", taskId: open[0].id, done: false, id: "y", at });
    assert.equal(onboardingFor(s, kemi.id).find((t) => t.id === open[0].id)!.doneAt, null);
    s = run(s, { type: "onboarding/add", employeeId: kemi.id, title: "  Shadow a payroll run ", owner: "Manager", dueDate: "2026-11-20", id: "add1", at });
    const added = onboardingFor(s, kemi.id).at(-1)!;
    assert.equal(added.title, "Shadow a payroll run");
    assert.equal(added.position, ONBOARDING_TEMPLATE.length);
    assert.equal(run(s, { type: "onboarding/add", employeeId: kemi.id, title: "x", owner: "HR", dueDate: null, id: "a2", at }), s);
    assert.equal(run(s, { type: "onboarding/add", employeeId: kemi.id, title: "Valid", owner: "HR", dueDate: "soon", id: "a3", at }), s);
    s = run(s, { type: "onboarding/remove", taskId: "add1", id: "r", at });
    assert.equal(onboardingFor(s, kemi.id).length, ONBOARDING_TEMPLATE.length);
  });

  it("finds overdue steps only for current staff", () => {
    const s = fresh();
    const late = overdueOnboarding(s, "2026-12-31");
    assert.ok(late.length > 0 && late.every((t) => !t.doneAt));
    assert.equal(overdueOnboarding(s, "2000-01-01").length, 0);
  });

  it("lets anyone tick steps (server checks they're theirs), but only HR and managers manage them", () => {
    assert.ok(rolesFor("onboarding/toggle").includes("employee"));
    assert.deepEqual(rolesFor("onboarding/start"), ["hr_admin", "manager"]);
    assert.ok(!canPerform(live("recruiter"), "onboarding/add"));
    assert.ok(canPerform(live("manager"), "onboarding/remove"));
  });
});

describe("notifications", () => {
  it("shows HR what needs deciding, with stable ids", () => {
    const s = fresh();
    const items = notificationsFor(s, { mode: "demo" }, NOW);
    assert.ok(items.some((n) => n.href === "/leave"));
    assert.deepEqual(notificationsFor(s, { mode: "demo" }, NOW).map((n) => n.id), items.map((n) => n.id));
  });

  it("changes the id when the thing changes, so it shows as new again", () => {
    let s = fresh();
    const before = notificationsFor(s, { mode: "demo" }, NOW).find((n) => n.href === "/leave");
    const pending = s.leave.find((l) => l.status === "Pending")!;
    s = run(s, { type: "leave/decide", leaveId: pending.id, status: "Approved", id: "d", at });
    const after = notificationsFor(s, { mode: "demo" }, NOW).find((n) => n.href === "/leave");
    assert.notEqual(before?.id, after?.id);
  });

  it("keeps recruiters to hiring and employees to their own things", () => {
    const s = fresh();
    const rec = notificationsFor(s, live("recruiter"), NOW);
    assert.ok(rec.every((n) => n.href.startsWith("/recruitment")));
    const kemi = s.employees.find((e) => e.status === "Onboarding")!;
    const mine = notificationsFor(s, live("employee", kemi.email, kemi.name), NOW);
    assert.ok(mine.length > 0 && mine.every((n) => n.href === "/me"));
    assert.ok(mine.some((n) => n.title.includes("onboarding step")));
    assert.equal(notificationsFor(s, live("employee", "nobody@example.com"), NOW).length, 0);
  });

  it("tells the payroll preparer they need a second admin, and others to approve", () => {
    let s = fresh();
    s = run(s, { type: "payroll/create", period: "2026-11", id: "p1", at, by: "Ada" });
    s = run(s, { type: "payroll/submit", runId: "p1", id: "p2", at, by: "Ada" });
    assert.ok(notificationsFor(s, live("hr_admin", "a@x.com", "Ada"), NOW).some((n) => n.title.includes("waiting for a second admin")));
    assert.ok(notificationsFor(s, live("hr_admin", "b@x.com", "Bola"), NOW).some((n) => n.title.startsWith("Approve November 2026")));
    assert.ok(!notificationsFor(s, live("manager"), NOW).some((n) => n.href === "/payroll"));
  });
});
