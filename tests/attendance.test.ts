// Unit tests for attendance (clock in / out, lateness, corrections). Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { appReducer } from "../lib/app-reducer";
import { hoursWorked, isLate, lagosDate, lagosTime, lagosToIso, lastDays } from "../lib/attendance";
import { createDemoData } from "../lib/demo-data";
import type { PeopleAction } from "../lib/people";
import { canPerform, rolesFor } from "../lib/workspace";

const NOW = new Date("2026-10-12T13:00:00Z"); // Monday, 14:00 in Lagos
const fresh = () => createDemoData(NOW);
const run = (s: ReturnType<typeof fresh>, a: PeopleAction) => appReducer(s, a);

describe("Lagos time helpers", () => {
  it("uses UTC+1 for dates and times", () => {
    assert.equal(lagosDate("2026-10-12T23:30:00Z"), "2026-10-13");
    assert.equal(lagosTime("2026-10-12T07:52:00Z"), "08:52");
    assert.equal(lagosToIso("2026-10-12", "09:00"), "2026-10-12T08:00:00.000Z");
    assert.deepEqual(lastDays("2026-10-12", 3), ["2026-10-10", "2026-10-11", "2026-10-12"]);
  });

  it("flags late arrivals after a 15 minute grace period", () => {
    const rec = (t: string) => ({ id: "r", employeeId: "e", date: "2026-10-12", clockIn: lagosToIso("2026-10-12", t), clockOut: null, mode: "Office" as const, correctedBy: "", correctedAt: null });
    assert.equal(isLate(rec("09:15"), "09:00"), false);
    assert.equal(isLate(rec("09:16"), "09:00"), true);
    assert.equal(isLate(rec("08:40"), "08:30"), false);
    assert.equal(hoursWorked({ ...rec("08:00"), clockOut: lagosToIso("2026-10-12", "17:30") }), 9.5);
    assert.equal(hoursWorked(rec("08:00")), null);
    assert.equal(hoursWorked(rec("13:00"), NOW), 1);
  });
});

describe("attendance", () => {
  it("seeds a week of weekday clock-ins, none on weekends or approved leave", () => {
    const s = fresh();
    assert.ok(s.attendance.length > 40);
    for (const r of s.attendance) {
      const d = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      assert.ok(d !== 0 && d !== 6, `weekend record ${r.date}`);
      assert.ok(!s.leave.some((l) => l.employeeId === r.employeeId && l.status === "Approved" && l.startDate <= r.date && l.endDate >= r.date));
    }
    assert.equal(new Set(s.attendance.map((r) => `${r.employeeId}|${r.date}`)).size, s.attendance.length);
  });

  it("clocks in once per Lagos day, then out once", () => {
    let s = fresh();
    const emp = s.employees.find((e) => e.status === "Active" && !s.attendance.some((r) => r.employeeId === e.id && r.date === "2026-10-12"))!;
    s = run(s, { type: "attendance/clockIn", employeeId: emp.id, mode: "Remote", id: "a1", at: "2026-10-12T08:05:00.000Z" });
    const rec = s.attendance.find((r) => r.id === "a1")!;
    assert.equal(rec.date, "2026-10-12");
    assert.equal(rec.mode, "Remote");
    assert.equal(run(s, { type: "attendance/clockIn", employeeId: emp.id, mode: "Office", id: "a2", at: "2026-10-12T09:00:00.000Z" }), s);
    assert.equal(run(s, { type: "attendance/clockOut", recordId: "a1", id: "x", at: "2026-10-12T08:00:00.000Z" }), s, "clock-out before clock-in ignored");
    s = run(s, { type: "attendance/clockOut", recordId: "a1", id: "x", at: "2026-10-12T16:35:00.000Z" });
    assert.equal(hoursWorked(s.attendance.find((r) => r.id === "a1")!), 8.5);
    assert.equal(run(s, { type: "attendance/clockOut", recordId: "a1", id: "y", at: "2026-10-12T17:00:00.000Z" }), s);
    const exited = s.employees.find((e) => e.status === "Exited")!;
    assert.equal(run(s, { type: "attendance/clockIn", employeeId: exited.id, mode: "Office", id: "a3", at: "2026-10-12T08:00:00.000Z" }), s);
  });

  it("lets HR correct times, records who did it, and rejects impossible times", () => {
    let s = fresh();
    const rec = s.attendance[0];
    assert.equal(run(s, { type: "attendance/correct", recordId: rec.id, clockIn: "17:00", clockOut: "09:00", id: "c", at: NOW.toISOString() }), s);
    assert.equal(run(s, { type: "attendance/correct", recordId: rec.id, clockIn: "9am", clockOut: null, id: "c", at: NOW.toISOString() }), s);
    s = run(s, { type: "attendance/correct", recordId: rec.id, clockIn: "08:30", clockOut: "17:00", id: "c", at: NOW.toISOString(), by: "Ada Obi" });
    const fixed = s.attendance.find((r) => r.id === rec.id)!;
    assert.equal(lagosTime(fixed.clockIn), "08:30");
    assert.equal(fixed.correctedBy, "Ada Obi");
    assert.equal(s.activity[0].title, "Attendance corrected");
  });

  it("everyone clocks themselves; only HR admins correct", () => {
    assert.ok(rolesFor("attendance/clockIn").includes("employee"));
    assert.ok(rolesFor("attendance/clockOut").includes("recruiter"));
    assert.deepEqual(rolesFor("attendance/correct"), ["hr_admin"]);
    assert.ok(!canPerform({ mode: "live", orgId: "o", orgName: "A", me: { userId: "u", name: "M", email: "m@x", role: "manager" } }, "attendance/correct"));
  });

  it("validates the work start time in settings", () => {
    const s = fresh();
    assert.equal(run(s, { type: "settings/update", id: "s", at: NOW.toISOString(), settings: { ...s.settings, workStart: "25:00" } }), s);
    assert.equal(run(s, { type: "settings/update", id: "s", at: NOW.toISOString(), settings: { ...s.settings, workStart: "08:30" } }).settings.workStart, "08:30");
  });
});
