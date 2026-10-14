// Reads and writes MagHR data in Supabase.
//
// The approach: business rules live in ONE place, the pure reducer in lib/recruitment.ts.
// To save a change, the server loads the company's current data, runs the same reducer
// with a server-side timestamp and the real user's name, and writes only the rows that
// changed. Row-level security in the database is the final gate on who may change what.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoState } from "../demo-data";
import { normaliseBank, normaliseJob, normalisePersonal } from "../employee-record";
import { normaliseConfig } from "../paye";
import type { Activity, AttendanceRecord, Candidate, Employee, Goal, Interview, Job, LeaveRequest, Note, OnboardingTask, PayrollLine, PayrollRun, Review, SelfServiceRequest, StageChange } from "../types";

type Row = Record<string, unknown>;

const s = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const n = (v: unknown, fallback = 0) => (typeof v === "number" ? v : fallback);

function toJob(r: Row): Job {
  return {
    id: s(r.id),
    code: s(r.code),
    title: s(r.title),
    department: s(r.department) as Job["department"],
    location: s(r.location),
    employmentType: s(r.employment_type) as Job["employmentType"],
    description: s(r.description),
    owner: s(r.owner),
    status: s(r.status) as Job["status"],
    createdAt: s(r.created_at),
    requirements: Array.isArray(r.requirements) ? (r.requirements as Job["requirements"]) : [],
    channels: r.channels && typeof r.channels === "object" ? (r.channels as Job["channels"]) : {},
  };
}

function toCandidate(r: Row, notes: Note[], interviews: Interview[], history: StageChange[]): Candidate {
  const p = (r.profile ?? {}) as Partial<Candidate["profile"]>;
  return {
    id: s(r.id),
    name: s(r.name),
    email: s(r.email),
    phone: s(r.phone),
    jobId: (r.job_id as string | null) ?? null,
    cvStatus: s(r.cv_status) as Candidate["cvStatus"],
    stage: s(r.stage) as Candidate["stage"],
    rating: n(r.rating),
    notes,
    interviews,
    offerStatus: s(r.offer_status) as Candidate["offerStatus"],
    inTalentPool: Boolean(r.in_talent_pool),
    convertedToEmployeeId: (r.converted_employee_id as string | null) ?? null,
    stageHistory: history,
    source: s(r.source, "Added manually") as Candidate["source"],
    profile: {
      headline: s(p.headline),
      skills: Array.isArray(p.skills) ? p.skills.filter((x): x is string => typeof x === "string") : [],
      yearsExperience: n(p.yearsExperience),
      location: s(p.location),
      education: s(p.education),
    },
    requirementReviews: (r.requirement_reviews ?? {}) as Candidate["requirementReviews"],
    sourcedProfileId: (r.sourced_profile_id as string | null) ?? null,
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

function toEmployee(r: Row): Employee {
  return {
    id: s(r.id),
    name: s(r.name),
    email: s(r.email),
    department: s(r.department) as Employee["department"],
    jobTitle: s(r.job_title),
    location: s(r.location),
    startDate: s(r.start_date),
    status: s(r.status) as Employee["status"],
    source: s(r.source) as Employee["source"],
    phone: s(r.phone),
    managerName: s(r.manager_name),
    employmentType: s(r.employment_type, "Full-time") as Employee["employmentType"],
    exitedOn: (r.exited_on as string | null) ?? null,
    exitReason: s(r.exit_reason),
    exitChecklist: Array.isArray(r.exit_checklist) ? r.exit_checklist.filter((x): x is string => typeof x === "string") : [],
  };
}

function groupBy<T>(rows: Row[], key: string, map: (r: Row) => T): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = s(r[key]);
    const list = out.get(k) ?? [];
    list.push(map(r));
    out.set(k, list);
  }
  return out;
}

/**
 * Like rows(), but returns [] when the table doesn't exist yet, so the app keeps working
 * between deploying new code and running the matching database migration.
 */
async function optionalRows(q: PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }>): Promise<Row[]> {
  const { data, error } = await q;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

async function rows(q: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function runTotalColumns(r: PayrollRun) {
  return {
    paye_total: r.payeTotal,
    pension_total: r.pensionTotal,
    nhf_total: r.nhfTotal,
    net_total: r.netTotal,
    employer_pension_total: r.employerPensionTotal,
  };
}

function lineRow(orgId: string, l: PayrollLine) {
  return {
    ...(isUuid(l.id) ? { id: l.id } : {}),
    org_id: orgId,
    run_id: l.runId,
    employee_id: l.employeeId,
    employee_name: l.employeeName,
    gross: l.gross,
    basic: l.basic,
    housing: l.housing,
    transport: l.transport,
    other: l.other,
    pension: l.pension,
    nhf: l.nhf,
    paye: l.paye,
    net: l.net,
    employer_pension: l.employerPension,
    rent_relief: l.rentRelief,
    taxable: l.taxable,
  };
}

/** Loads everything the current user may see in their organisation. RLS filters by role. */
export async function loadState(supabase: SupabaseClient, orgId: string): Promise<DemoState> {
  const [jobs, candidates, notes, interviews, history, employees, activity, inbox] = await Promise.all([
    rows(supabase.from("jobs").select("*").eq("org_id", orgId).order("created_at", { ascending: false })),
    rows(supabase.from("candidates").select("*").eq("org_id", orgId).order("created_at", { ascending: false })),
    rows(supabase.from("candidate_notes").select("*").eq("org_id", orgId).order("created_at", { ascending: false })),
    rows(supabase.from("interviews").select("*").eq("org_id", orgId).order("scheduled_for")),
    rows(supabase.from("stage_history").select("*").eq("org_id", orgId).order("at")),
    rows(supabase.from("employees").select("*").eq("org_id", orgId).order("name")),
    rows(supabase.from("activity").select("*").eq("org_id", orgId).order("at", { ascending: false }).limit(50)),
    rows(supabase.from("inbox_requests").select("*").eq("org_id", orgId).order("at", { ascending: false }).limit(100)),
  ]);
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const [org, comp, leaveRows, goalRows, reviewRows, payrollRows, holidayRows, onboardingRows, attendanceRows, workStartRows, careersRows, payrollConfigRows, rentRows, lineRows, recordRows, bankRows] = await Promise.all([
    rows(supabase.from("organizations").select("name, leave_allowance_days").eq("id", orgId).limit(1)),
    optionalRows(supabase.from("employee_compensation").select("employee_id, monthly_gross").eq("org_id", orgId)), // HR admins only (RLS)
    optionalRows(supabase.from("leave_requests").select("*").eq("org_id", orgId).order("start_date", { ascending: false }).limit(500)),
    optionalRows(supabase.from("goals").select("*").eq("org_id", orgId).order("due_date")),
    optionalRows(supabase.from("reviews").select("*").eq("org_id", orgId)),
    optionalRows(supabase.from("payroll_runs").select("*").eq("org_id", orgId).order("period", { ascending: false })),
    optionalRows(supabase.from("company_holidays").select("id, date, name").eq("org_id", orgId).order("date")),
    optionalRows(supabase.from("onboarding_tasks").select("*").eq("org_id", orgId).order("position")), // HR, managers, and the new hire (RLS)
    optionalRows(supabase.from("attendance").select("*").eq("org_id", orgId).gte("date", since).order("date", { ascending: false }).limit(5000)), // HR, managers, own (RLS)
    optionalRows(supabase.from("organizations").select("work_start").eq("id", orgId).limit(1)), // added by the attendance migration
    optionalRows(supabase.from("organizations").select("careers_enabled, careers_slug, careers_intro").eq("id", orgId).limit(1)), // careers migration
    optionalRows(supabase.from("organizations").select("payroll_config").eq("id", orgId).limit(1)), // PAYE migration
    optionalRows(supabase.from("employee_compensation").select("employee_id, annual_rent").eq("org_id", orgId)), // HR admins; staff see their own
    optionalRows(supabase.from("payroll_lines").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5000)), // HR; staff own approved
    optionalRows(supabase.from("employee_records").select("employee_id, personal, job").eq("org_id", orgId)), // HR; staff own
    optionalRows(supabase.from("employee_bank").select("employee_id, data").eq("org_id", orgId)), // HR; staff own (read)
  ]);

  const notesBy = groupBy<Note>(notes, "candidate_id", (r) => ({ id: s(r.id), text: s(r.text), author: s(r.author_name), createdAt: s(r.created_at) }));
  const interviewsBy = groupBy<Interview>(interviews, "candidate_id", (r) => ({
    id: s(r.id),
    scheduledFor: s(r.scheduled_for),
    mode: s(r.mode) as Interview["mode"],
    interviewers: s(r.interviewers),
    location: s(r.location),
    status: s(r.status) as Interview["status"],
  }));
  const historyBy = groupBy<StageChange>(history, "candidate_id", (r) => ({
    from: (r.from_stage as StageChange["from"]) ?? null,
    to: s(r.to_stage) as StageChange["to"],
    at: s(r.at),
    by: s(r.by_name),
  }));

  return {
    jobs: jobs.map(toJob),
    candidates: candidates.map((r) => toCandidate(r, notesBy.get(s(r.id)) ?? [], interviewsBy.get(s(r.id)) ?? [], historyBy.get(s(r.id)) ?? [])),
    employees: employees.map(toEmployee),
    activity: activity.map<Activity>((r) => ({ id: s(r.id), kind: s(r.kind) as Activity["kind"], title: s(r.title), detail: s(r.detail), at: s(r.at) })),
    pay: Object.fromEntries(comp.map((r) => [s(r.employee_id), Number(r.monthly_gross) || 0])),
    leave: leaveRows.map((r) => ({
      id: s(r.id),
      employeeId: s(r.employee_id),
      leaveType: s(r.leave_type) as LeaveRequest["leaveType"],
      startDate: s(r.start_date),
      endDate: s(r.end_date),
      days: n(r.days),
      reason: s(r.reason),
      status: s(r.status) as LeaveRequest["status"],
      decidedBy: s(r.decided_by_name),
      decidedAt: (r.decided_at as string | null) ?? null,
      createdAt: s(r.created_at),
    })),
    goals: goalRows.map((r) => ({
      id: s(r.id),
      title: s(r.title),
      ownerName: s(r.owner_name),
      department: s(r.department) as Goal["department"],
      dueDate: s(r.due_date),
      progress: n(r.progress),
      createdAt: s(r.created_at),
    })),
    reviews: reviewRows.map((r) => ({
      id: s(r.id),
      employeeId: s(r.employee_id),
      cycle: s(r.cycle),
      status: s(r.status) as Review["status"],
      rating: typeof r.rating === "number" ? r.rating : null,
      summary: s(r.summary),
      selfAppraisal: s(r.self_appraisal),
      selfSubmittedAt: r.self_submitted_at ? s(r.self_submitted_at) : null,
      reviewerName: s(r.reviewer_name),
      updatedAt: s(r.updated_at),
    })),
    payrollRuns: payrollRows.map((r) => ({
      id: s(r.id),
      period: s(r.period),
      status: s(r.status) as PayrollRun["status"],
      employeeCount: n(r.employee_count),
      grossTotal: Number(r.gross_total) || 0,
      payeTotal: Number(r.paye_total) || 0,
      pensionTotal: Number(r.pension_total) || 0,
      nhfTotal: Number(r.nhf_total) || 0,
      netTotal: Number(r.net_total) || 0,
      employerPensionTotal: Number(r.employer_pension_total) || 0,
      preparedBy: s(r.prepared_by_name),
      approvedBy: s(r.approved_by_name),
      approvedAt: (r.approved_at as string | null) ?? null,
      createdAt: s(r.created_at),
    })),
    settings: {
      companyName: s(org[0]?.name, "Your company"),
      leaveAllowanceDays: n(org[0]?.leave_allowance_days, 20),
      workStart: s(workStartRows[0]?.work_start, "09:00"),
    },
    holidays: holidayRows.map((r) => ({ id: s(r.id), date: s(r.date), name: s(r.name) })),
    payrollConfig: normaliseConfig(payrollConfigRows[0]?.payroll_config),
    records: Object.fromEntries(recordRows.map((r) => [s(r.employee_id), { personal: normalisePersonal(r.personal), job: normaliseJob(r.job) }])),
    bank: Object.fromEntries(bankRows.map((r) => [s(r.employee_id), normaliseBank(r.data)])),
    rent: Object.fromEntries(rentRows.filter((r) => Number(r.annual_rent) > 0).map((r) => [s(r.employee_id), Number(r.annual_rent)])),
    payrollLines: lineRows.map((r) => ({
      id: s(r.id),
      runId: s(r.run_id),
      employeeId: s(r.employee_id),
      employeeName: s(r.employee_name),
      gross: Number(r.gross) || 0,
      basic: Number(r.basic) || 0,
      housing: Number(r.housing) || 0,
      transport: Number(r.transport) || 0,
      other: Number(r.other) || 0,
      pension: Number(r.pension) || 0,
      nhf: Number(r.nhf) || 0,
      paye: Number(r.paye) || 0,
      net: Number(r.net) || 0,
      employerPension: Number(r.employer_pension) || 0,
      rentRelief: Number(r.rent_relief) || 0,
      taxable: Number(r.taxable) || 0,
    })),
    careers: {
      enabled: Boolean(careersRows[0]?.careers_enabled),
      slug: s(careersRows[0]?.careers_slug),
      intro: s(careersRows[0]?.careers_intro),
    },
    attendance: attendanceRows.map((r) => ({
      id: s(r.id),
      employeeId: s(r.employee_id),
      date: s(r.date),
      clockIn: s(r.clock_in),
      clockOut: (r.clock_out as string | null) ?? null,
      mode: s(r.mode, "Office") as AttendanceRecord["mode"],
      correctedBy: s(r.corrected_by_name),
      correctedAt: (r.corrected_at as string | null) ?? null,
    })),
    onboarding: onboardingRows.map((r) => ({
      id: s(r.id),
      employeeId: s(r.employee_id),
      title: s(r.title),
      owner: s(r.owner) as OnboardingTask["owner"],
      dueDate: (r.due_date as string | null) ?? null,
      doneAt: (r.done_at as string | null) ?? null,
      doneBy: s(r.done_by_name),
      position: n(r.position),
    })),
    talentDb: [], // MyJobMag CV database: needs MyJobMag API approval
    invitations: [],
    inbox: inbox.map<SelfServiceRequest>((r) => ({
      id: s(r.id),
      channel: "WhatsApp",
      from: s(r.from_name),
      role: s(r.role) as SelfServiceRequest["role"],
      kind: s(r.kind) as SelfServiceRequest["kind"],
      detail: s(r.detail),
      status: s(r.status) as SelfServiceRequest["status"],
      at: s(r.at),
    })),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function jobRow(j: Job, orgId: string) {
  return {
    id: j.id,
    org_id: orgId,
    code: j.code,
    title: j.title,
    department: j.department,
    location: j.location,
    employment_type: j.employmentType,
    description: j.description,
    owner: j.owner,
    status: j.status,
    requirements: j.requirements,
    channels: j.channels,
  };
}

function candidateRow(c: Candidate, orgId: string) {
  return {
    id: c.id,
    org_id: orgId,
    job_id: c.jobId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    cv_status: c.cvStatus,
    stage: c.stage,
    rating: c.rating,
    offer_status: c.offerStatus,
    in_talent_pool: c.inTalentPool,
    source: c.source,
    profile: c.profile,
    requirement_reviews: c.requirementReviews,
    sourced_profile_id: c.sourcedProfileId,
  };
}

async function check(q: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await q;
  if (error) throw new Error(error.message);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Writes the differences between two states. Stage history is not written here:
 * a database trigger records it, so it cannot be forged.
 */
export async function writeChanges(supabase: SupabaseClient, orgId: string, before: DemoState, after: DemoState) {
  // Jobs
  const jobsBefore = new Map(before.jobs.map((j) => [j.id, j]));
  for (const j of after.jobs) {
    const prev = jobsBefore.get(j.id);
    if (!prev) await check(supabase.from("jobs").insert(jobRow(j, orgId)));
    else if (!same(prev, j)) {
      const { id, org_id, ...changes } = jobRow(j, orgId);
      void org_id;
      await check(supabase.from("jobs").update(changes).eq("id", id));
    }
  }

  // Employees created by conversion go through the database function, which re-checks the rules.
  const empBefore = new Set(before.employees.map((e) => e.id));
  const converted = new Map<string, Employee>();
  for (const e of after.employees) if (!empBefore.has(e.id)) converted.set(e.id, e);

  // Candidates and their notes/interviews
  const candBefore = new Map(before.candidates.map((c) => [c.id, c]));
  for (const c of after.candidates) {
    const prev = candBefore.get(c.id);
    if (!prev) {
      await check(supabase.from("candidates").insert(candidateRow(c, orgId)));
    } else {
      const a = candidateRow(prev, orgId);
      const b = candidateRow(c, orgId);
      const changes: Record<string, unknown> = {};
      for (const k of Object.keys(b) as (keyof typeof b)[]) if (!same(a[k], b[k])) changes[k] = b[k];
      if (Object.keys(changes).length) await check(supabase.from("candidates").update(changes).eq("id", c.id));
    }

    const noteIds = new Set((prev?.notes ?? []).map((x) => x.id));
    for (const note of c.notes) {
      if (noteIds.has(note.id)) continue;
      await check(
        supabase.from("candidate_notes").insert({
          ...(isUuid(note.id) ? { id: note.id } : {}),
          org_id: orgId,
          candidate_id: c.id,
          text: note.text,
          author_name: note.author,
        }),
      );
    }

    const prevInterviews = new Map((prev?.interviews ?? []).map((i) => [i.id, i]));
    for (const i of c.interviews) {
      const p = prevInterviews.get(i.id);
      if (!p) {
        await check(
          supabase.from("interviews").insert({
            ...(isUuid(i.id) ? { id: i.id } : {}),
            org_id: orgId,
            candidate_id: c.id,
            scheduled_for: i.scheduledFor,
            mode: i.mode,
            interviewers: i.interviewers,
            location: i.location,
            status: i.status,
          }),
        );
      } else if (p.status !== i.status) {
        await check(supabase.from("interviews").update({ status: i.status }).eq("id", i.id));
      }
    }

    if (prev && !prev.convertedToEmployeeId && c.convertedToEmployeeId) {
      const e = converted.get(c.convertedToEmployeeId);
      if (e) {
        await check(
          supabase.rpc("convert_candidate_to_employee", {
            p_candidate: c.id,
            p_department: e.department,
            p_job_title: e.jobTitle,
            p_location: e.location,
            p_start_date: e.startDate,
            p_employee: isUuid(e.id) ? e.id : null,
          }),
        );
      }
    }
  }

  // Employees added or edited directly (conversions are handled with the candidate above)
  const empPrev = new Map(before.employees.map((e) => [e.id, e]));
  for (const e of after.employees) {
    const prev = empPrev.get(e.id);
    const row = {
      name: e.name,
      email: e.email,
      phone: e.phone,
      department: e.department,
      job_title: e.jobTitle,
      location: e.location,
      start_date: e.startDate,
      status: e.status,
      manager_name: e.managerName,
      employment_type: e.employmentType,
      exited_on: e.exitedOn,
      exit_reason: e.exitReason,
      exit_checklist: e.exitChecklist,
    };
    if (!prev) {
      if (e.source === "Converted from candidate") continue;
      await check(supabase.from("employees").insert({ ...(isUuid(e.id) ? { id: e.id } : {}), org_id: orgId, source: "Added manually", ...row }));
    } else if (!same(prev, e)) {
      await check(supabase.from("employees").update(row).eq("id", e.id));
    }
  }

  // Pay (HR admins only; RLS refuses anyone else)
  for (const [employeeId, amount] of Object.entries(after.pay)) {
    if (before.pay[employeeId] === amount) continue;
    await check(
      supabase
        .from("employee_compensation")
        .upsert({ org_id: orgId, employee_id: employeeId, monthly_gross: amount, updated_at: new Date().toISOString() }, { onConflict: "employee_id" }),
    );
  }

  // Leave
  const leavePrev = new Map(before.leave.map((l) => [l.id, l]));
  for (const l of after.leave) {
    const prev = leavePrev.get(l.id);
    if (!prev) {
      await check(
        supabase.from("leave_requests").insert({
          ...(isUuid(l.id) ? { id: l.id } : {}),
          org_id: orgId,
          employee_id: l.employeeId,
          leave_type: l.leaveType,
          start_date: l.startDate,
          end_date: l.endDate,
          days: l.days,
          reason: l.reason,
        }),
      );
    } else if (prev.status !== l.status) {
      await check(supabase.from("leave_requests").update({ status: l.status }).eq("id", l.id));
    }
  }

  // Goals
  const goalPrev = new Map(before.goals.map((g) => [g.id, g]));
  for (const g of after.goals) {
    const prev = goalPrev.get(g.id);
    if (!prev) {
      await check(
        supabase.from("goals").insert({
          ...(isUuid(g.id) ? { id: g.id } : {}),
          org_id: orgId,
          title: g.title,
          owner_name: g.ownerName,
          department: g.department,
          due_date: g.dueDate,
          progress: g.progress,
        }),
      );
    } else if (prev.progress !== g.progress) {
      await check(supabase.from("goals").update({ progress: g.progress }).eq("id", g.id));
    }
  }

  // Reviews (one per employee per cycle)
  const reviewPrev = new Map(before.reviews.map((r) => [r.id, r]));
  for (const r of after.reviews) {
    const prev = reviewPrev.get(r.id);
    if (prev && same(prev, r)) continue;
    await check(
      supabase.from("reviews").upsert(
        {
          ...(isUuid(r.id) ? { id: r.id } : {}),
          org_id: orgId,
          employee_id: r.employeeId,
          cycle: r.cycle,
          status: r.status,
          rating: r.rating,
          summary: r.summary,
          self_appraisal: r.selfAppraisal ?? "",
          self_submitted_at: r.selfSubmittedAt ?? null,
          reviewer_name: r.reviewerName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,employee_id,cycle" },
      ),
    );
  }

  // Payroll runs. Preparer/approver identity and timestamps are set by database triggers.
  const runPrev = new Map(before.payrollRuns.map((r) => [r.id, r]));
  for (const r of after.payrollRuns) {
    const prev = runPrev.get(r.id);
    if (!prev) {
      await check(
        supabase.from("payroll_runs").insert({
          ...(isUuid(r.id) ? { id: r.id } : {}),
          org_id: orgId,
          period: r.period,
          employee_count: r.employeeCount,
          gross_total: r.grossTotal,
          ...runTotalColumns(r),
        }),
      );
    } else if (prev.status !== r.status || prev.grossTotal !== r.grossTotal || prev.employeeCount !== r.employeeCount) {
      if (r.status === "Pending approval" && prev.status === "Draft") {
        // While still in Draft: lock in the latest totals and payslips, then submit.
        await check(supabase.from("payroll_runs").update({ employee_count: r.employeeCount, gross_total: r.grossTotal, ...runTotalColumns(r) }).eq("id", r.id));
        await check(supabase.from("payroll_lines").delete().eq("run_id", r.id));
        const lines = after.payrollLines.filter((l) => l.runId === r.id);
        if (lines.length) await check(supabase.from("payroll_lines").insert(lines.map((l) => lineRow(orgId, l))));
        await check(supabase.from("payroll_runs").update({ status: r.status }).eq("id", r.id));
      } else if (r.status === "Draft" && prev.status === "Pending approval") {
        // Back to Draft first (unlocks the payslips), then clear them.
        await check(supabase.from("payroll_runs").update({ status: r.status }).eq("id", r.id));
        await check(supabase.from("payroll_lines").delete().eq("run_id", r.id));
      } else {
        await check(supabase.from("payroll_runs").update({ status: r.status }).eq("id", r.id));
      }
    }
  }

  // Employee records (personal: HR or the person; job: HR only) and bank details (HR only)
  for (const [employeeId, rec] of Object.entries(after.records)) {
    const prev = before.records[employeeId];
    if (prev && same(prev, rec)) continue;
    if (!prev) {
      // A new record started by the person themselves has no job details (the database refuses them from non-HR users).
      const jobEmpty = !Object.values(rec.job).some((v) => (Array.isArray(v) ? v.length : Boolean(v)));
      await check(
        supabase.from("employee_records").upsert({ org_id: orgId, employee_id: employeeId, personal: rec.personal, ...(jobEmpty ? {} : { job: rec.job }) }, { onConflict: "employee_id" }),
      );
    } else {
      const patch: Record<string, unknown> = {};
      if (!same(prev.personal, rec.personal)) patch.personal = rec.personal;
      if (!same(prev.job, rec.job)) patch.job = rec.job;
      await check(supabase.from("employee_records").update(patch).eq("employee_id", employeeId));
    }
  }
  for (const [employeeId, b] of Object.entries(after.bank)) {
    if (before.bank[employeeId] && same(before.bank[employeeId], b)) continue;
    await check(supabase.from("employee_bank").upsert({ org_id: orgId, employee_id: employeeId, data: b }, { onConflict: "employee_id" }));
  }

  // Payroll rules and declared rent (HR admins only)
  if (!same(before.payrollConfig, after.payrollConfig)) {
    await check(supabase.from("organizations").update({ payroll_config: after.payrollConfig }).eq("id", orgId));
  }
  for (const [employeeId, amount] of Object.entries(after.rent)) {
    if (before.rent[employeeId] === amount) continue;
    if (typeof after.pay[employeeId] === "number") {
      await check(supabase.from("employee_compensation").update({ annual_rent: amount, updated_at: new Date().toISOString() }).eq("employee_id", employeeId));
    } else {
      await check(
        supabase
          .from("employee_compensation")
          .upsert({ org_id: orgId, employee_id: employeeId, monthly_gross: 0, annual_rent: amount, updated_at: new Date().toISOString() }, { onConflict: "employee_id" }),
      );
    }
  }

  // Company settings
  if (before.settings.companyName !== after.settings.companyName || before.settings.leaveAllowanceDays !== after.settings.leaveAllowanceDays) {
    await check(
      supabase.from("organizations").update({ name: after.settings.companyName, leave_allowance_days: after.settings.leaveAllowanceDays }).eq("id", orgId),
    );
  }
  if (before.settings.workStart !== after.settings.workStart) {
    await check(supabase.from("organizations").update({ work_start: after.settings.workStart }).eq("id", orgId));
  }

  if (!same(before.careers, after.careers)) {
    await check(
      supabase
        .from("organizations")
        .update({ careers_enabled: after.careers.enabled, careers_slug: after.careers.slug || null, careers_intro: after.careers.intro })
        .eq("id", orgId),
    );
  }

  // Attendance (the database stamps clock-in/out times; HR corrections are signed by the database)
  const attBefore = new Map(before.attendance.map((r) => [r.id, r]));
  for (const r of after.attendance) {
    const p = attBefore.get(r.id);
    if (!p) {
      await check(supabase.from("attendance").insert({ ...(isUuid(r.id) ? { id: r.id } : {}), org_id: orgId, employee_id: r.employeeId, date: r.date, mode: r.mode }));
    } else if (r.correctedAt !== p.correctedAt) {
      await check(supabase.from("attendance").update({ clock_in: r.clockIn, clock_out: r.clockOut, corrected_at: new Date().toISOString() }).eq("id", r.id));
    } else if (!p.clockOut && r.clockOut) {
      await check(supabase.from("attendance").update({ clock_out: r.clockOut }).eq("id", r.id));
    }
  }

  // Company holidays
  const holBefore = new Set(before.holidays.map((h) => h.id));
  const holAfter = new Set(after.holidays.map((h) => h.id));
  for (const h of after.holidays) {
    if (holBefore.has(h.id)) continue;
    await check(supabase.from("company_holidays").insert({ ...(isUuid(h.id) ? { id: h.id } : {}), org_id: orgId, date: h.date, name: h.name }));
  }
  for (const h of before.holidays) {
    if (!holAfter.has(h.id)) await check(supabase.from("company_holidays").delete().eq("id", h.id));
  }

  // Onboarding checklists (the database stamps who ticked a step and when)
  const onbBefore = new Map(before.onboarding.map((t) => [t.id, t]));
  const onbAfter = new Set(after.onboarding.map((t) => t.id));
  const onbNew = after.onboarding.filter((t) => !onbBefore.has(t.id));
  if (onbNew.length) {
    await check(
      supabase.from("onboarding_tasks").insert(
        onbNew.map((t) => ({
          ...(isUuid(t.id) ? { id: t.id } : {}),
          org_id: orgId,
          employee_id: t.employeeId,
          title: t.title,
          owner: t.owner,
          due_date: t.dueDate,
          position: t.position,
        })),
      ),
    );
  }
  for (const t of after.onboarding) {
    const p = onbBefore.get(t.id);
    if (p && Boolean(p.doneAt) !== Boolean(t.doneAt)) {
      await check(supabase.from("onboarding_tasks").update({ done_at: t.doneAt ? new Date().toISOString() : null }).eq("id", t.id));
    }
  }
  for (const t of before.onboarding) {
    if (!onbAfter.has(t.id)) await check(supabase.from("onboarding_tasks").delete().eq("id", t.id));
  }

  // Inbox decisions
  const inboxBefore = new Map(before.inbox.map((r) => [r.id, r]));
  for (const r of after.inbox) {
    const p = inboxBefore.get(r.id);
    if (p && p.status !== r.status) await check(supabase.from("inbox_requests").update({ status: r.status }).eq("id", r.id));
  }

  // Activity feed (new entries only)
  const actBefore = new Set(before.activity.map((a) => a.id));
  const fresh = after.activity.filter((a) => !actBefore.has(a.id)).reverse();
  if (fresh.length) {
    await check(supabase.from("activity").insert(fresh.map((a) => ({ org_id: orgId, kind: a.kind, title: a.title, detail: a.detail }))));
  }
}
