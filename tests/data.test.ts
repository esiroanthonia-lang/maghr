// Tests how changes become database writes, using a fake Supabase client that records calls.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createDemoData, type DemoState } from "../lib/demo-data";
import { appReducer as recruitmentReducer, type AppAction as RecruitmentAction } from "../lib/app-reducer";
import { writeChanges } from "../lib/server/data";

interface Call {
  table: string;
  op: string;
  payload?: unknown;
  filters: [string, unknown][];
}

function fakeClient() {
  const calls: Call[] = [];
  const builder = (table: string) => {
    const call: Call = { table, op: "", filters: [] };
    const chain = {
      insert(payload: unknown) {
        call.op = "insert";
        call.payload = payload;
        calls.push(call);
        return chain;
      },
      upsert(payload: unknown) {
        call.op = "upsert";
        call.payload = payload;
        calls.push(call);
        return chain;
      },
      update(payload: unknown) {
        call.op = "update";
        call.payload = payload;
        calls.push(call);
        return chain;
      },
      eq(col: string, v: unknown) {
        call.filters.push([col, v]);
        return chain;
      },
      then(resolve: (v: { error: null }) => void) {
        resolve({ error: null });
      },
    };
    return chain;
  };
  const client = {
    from: builder,
    rpc(fn: string, args: unknown) {
      calls.push({ table: fn, op: "rpc", payload: args, filters: [] });
      return Promise.resolve({ error: null });
    },
  };
  return { client, calls };
}

const ORG = "11111111-1111-4111-8111-111111111111";
const at = "2026-10-12T14:00:00.000Z";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function apply(state: DemoState, action: RecruitmentAction) {
  const after = recruitmentReducer(state, action);
  const { client, calls } = fakeClient();
  await writeChanges(client as never, ORG, state, after);
  return calls;
}

describe("writeChanges", () => {
  const base = () => createDemoData(new Date("2026-10-12T13:00:00Z"));

  it("updates only the changed columns when a stage moves (history is left to the database trigger)", async () => {
    const s = base();
    const amaka = s.candidates.find((c) => c.name === "Amaka Okafor")!;
    const calls = await apply(s, { type: "candidate/moveStage", id: uuid(1), at, by: "Ada", candidateId: amaka.id, to: "Screening" });
    const upd = calls.filter((c) => c.table === "candidates");
    assert.equal(upd.length, 1);
    assert.equal(upd[0].op, "update");
    assert.deepEqual(upd[0].payload, { stage: "Screening", cv_status: "Reviewed" });
    assert.deepEqual(upd[0].filters, [["id", amaka.id]]);
    assert.ok(!calls.some((c) => c.table === "stage_history"), "stage history must not be written by the app");
    assert.ok(calls.some((c) => c.table === "activity" && c.op === "insert"));
  });

  it("inserts a new job with the organisation id", async () => {
    const s = base();
    const calls = await apply(s, {
      type: "job/add",
      id: uuid(2),
      at,
      input: { title: "Data Analyst", department: "Finance", location: "Lagos", employmentType: "Full-time", owner: "Ada", description: "Analyse data for the business.", status: "Open", requirements: ["SQL"], channels: ["MyJobMag"] },
    });
    const ins = calls.find((c) => c.table === "jobs" && c.op === "insert");
    assert.ok(ins);
    const row = ins.payload as Record<string, unknown>;
    assert.equal(row.id, uuid(2));
    assert.equal(row.org_id, ORG);
    assert.equal(row.code, "MJ-1025");
    assert.equal(row.employment_type, "Full-time");
  });

  it("inserts notes and interviews as their own rows", async () => {
    const s = base();
    const zainab = s.candidates.find((c) => c.name === "Zainab Yusuf")!;
    const noteCalls = await apply(s, { type: "candidate/addNote", id: uuid(3), at, by: "Ada", candidateId: zainab.id, text: "Great portfolio" });
    const note = noteCalls.find((c) => c.table === "candidate_notes");
    assert.deepEqual(note?.payload, { id: uuid(3), org_id: ORG, candidate_id: zainab.id, text: "Great portfolio", author_name: "Ada" });

    const intCalls = await apply(s, {
      type: "candidate/scheduleInterview",
      id: uuid(4),
      at,
      candidateId: zainab.id,
      input: { scheduledFor: "2026-10-14T09:00:00.000Z", mode: "Video call", interviewers: "Ada", location: "Link", moveToInterviewStage: true },
    });
    assert.ok(intCalls.some((c) => c.table === "interviews" && c.op === "insert"));
    assert.deepEqual(intCalls.find((c) => c.table === "candidates")?.payload, { stage: "Interview" });
  });

  it("converts through the database function, never by inserting employees directly", async () => {
    const s = base();
    const yetunde = s.candidates.find((c) => c.name === "Yetunde Bakare")!;
    const calls = await apply(s, {
      type: "candidate/convertToEmployee",
      id: uuid(5),
      at,
      candidateId: yetunde.id,
      input: { department: "People Operations", jobTitle: "HR Associate", location: "Lagos", startDate: "2026-11-02" },
    });
    const rpc = calls.find((c) => c.op === "rpc");
    assert.equal(rpc?.table, "convert_candidate_to_employee");
    assert.deepEqual(rpc?.payload, {
      p_candidate: yetunde.id,
      p_department: "People Operations",
      p_job_title: "HR Associate",
      p_location: "Lagos",
      p_start_date: "2026-11-02",
      p_employee: uuid(5),
    });
    assert.ok(!calls.some((c) => c.table === "employees"));
  });

  it("writes nothing when nothing changed", async () => {
    const s = base();
    const { client, calls } = fakeClient();
    await writeChanges(client as never, ORG, s, s);
    assert.equal(calls.length, 0);
  });

  it("people: leave decision updates status only; database stamps who decided", async () => {
    const s = base();
    const calls = await apply(s, { type: "leave/decide", id: uuid(6), at, by: "Ada", leaveId: "lv-001", status: "Approved" });
    const upd = calls.find((c) => c.table === "leave_requests");
    assert.deepEqual(upd?.payload, { status: "Approved" });
    assert.deepEqual(upd?.filters, [["id", "lv-001"]]);
  });

  it("people: new employee and pay are written to separate tables", async () => {
    const s = base();
    const calls = await apply(s, {
      type: "employee/add",
      id: uuid(7),
      at,
      input: { name: "New Person", email: "new.person@example.com", phone: "", department: "Sales", jobTitle: "Rep", location: "Lagos", startDate: "2026-11-01", managerName: "", employmentType: "Full-time", status: "Onboarding" },
      monthlyGross: 300000,
    });
    const emp = calls.find((c) => c.table === "employees" && c.op === "insert")?.payload as Record<string, unknown>;
    assert.equal(emp.id, uuid(7));
    assert.equal(emp.org_id, ORG);
    assert.ok(!("monthly_gross" in emp), "pay must not be stored on the employee row");
    assert.ok(calls.some((c) => c.table === "employee_compensation"));
  });

  it("people: payroll submit locks totals then changes status", async () => {
    let s = base();
    s = recruitmentReducer(s, { type: "payroll/create", id: uuid(8), at, by: "Ada", period: "2026-10" });
    const calls = await apply(s, { type: "payroll/submit", id: uuid(9), at, by: "Ada", runId: uuid(8) });
    const ups = calls.filter((c) => c.table === "payroll_runs").map((c) => c.payload as Record<string, unknown>);
    assert.ok("gross_total" in ups[0]);
    assert.deepEqual(ups[1], { status: "Pending approval" });
  });

  it("people: settings update the organisation row", async () => {
    const s = base();
    const calls = await apply(s, { type: "settings/update", id: uuid(10), at, settings: { companyName: "Acme Nigeria", leaveAllowanceDays: 22, workStart: "09:00" } });
    assert.deepEqual(calls.find((c) => c.table === "organizations")?.payload, { name: "Acme Nigeria", leave_allowance_days: 22 });
  });
  it("attendance: clock-in leaves times to the database; corrections send corrected_at", async () => {
    const s = base();
    const emp = s.employees.find((e) => e.status === "Active" && !s.attendance.some((r) => r.employeeId === e.id && r.date === "2026-10-12"))!;
    const calls = await apply(s, { type: "attendance/clockIn", employeeId: emp.id, mode: "Field", id: uuid(20), at: "2026-10-12T08:00:00.000Z" });
    const ins = calls.find((c) => c.table === "attendance");
    assert.equal(ins?.op, "insert");
    assert.deepEqual(ins?.payload, { id: uuid(20), org_id: ORG, employee_id: emp.id, date: "2026-10-12", mode: "Field" });
    const rec = s.attendance.find((r) => r.clockOut)!;
    const fix = await apply(s, { type: "attendance/correct", recordId: rec.id, clockIn: "08:00", clockOut: "16:00", id: uuid(21), at: "2026-10-12T13:00:00.000Z" });
    const up = fix.find((c) => c.table === "attendance");
    assert.equal(up?.op, "update");
    assert.ok((up?.payload as { corrected_at?: string }).corrected_at);
  });
});
