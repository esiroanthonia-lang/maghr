// Tests how changes become database writes, using a fake Supabase client that records calls.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createDemoData, type DemoState } from "../lib/demo-data";
import { recruitmentReducer, type RecruitmentAction } from "../lib/recruitment";
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
});
