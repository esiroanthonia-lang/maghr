// Unit tests for the recruitment state logic. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createDemoData } from "../lib/demo-data";
import { matchProfile, matchRequirement, parseRequirementLines } from "../lib/matching";
import {
  applicationCount,
  liveChannels,
  sourceCounts,
  filterCandidates,
  filterJobs,
  funnelCounts,
  nextAction,
  nextJobCode,
  pipelineCounts,
  recruitmentReducer,
  talentPool,
  type RecruitmentAction,
  type RecruitmentState,
} from "../lib/recruitment";

const NOW = new Date("2026-10-12T13:00:00Z");
const at = "2026-10-12T14:00:00.000Z";
const fresh = (): RecruitmentState => createDemoData(NOW);
const run = (s: RecruitmentState, a: RecruitmentAction) => recruitmentReducer(s, a);
const byName = (s: RecruitmentState, name: string) => {
  const c = s.candidates.find((x) => x.name === name);
  assert.ok(c, `candidate ${name} exists`);
  return c;
};

describe("demo data", () => {
  it("only uses example.com email addresses (synthetic data)", () => {
    const s = fresh();
    for (const c of s.candidates) assert.match(c.email, /@example\.com$/);
    for (const e of s.employees) assert.match(e.email, /@example\.com$/);
  });

  it("links every candidate to an existing job or the talent pool", () => {
    const s = fresh();
    const ids = new Set(s.jobs.map((j) => j.id));
    for (const c of s.candidates) assert.ok(c.jobId === null || ids.has(c.jobId));
  });
});

describe("jobs", () => {
  it("creates a job with the next code and logs activity", () => {
    const s = fresh();
    const next = run(s, {
      type: "job/add",
      id: "job-new",
      at,
      input: {
        title: "  Data Analyst ",
        department: "Finance",
        location: "Lagos",
        employmentType: "Full-time",
        owner: "Grace Nwosu",
        description: "Analyse hiring and workforce data.",
        status: "Open",
        requirements: ["2+ years of data analysis", "SQL"],
        channels: ["MyJobMag", "LinkedIn"],
      },
    });
    assert.equal(next.jobs.length, s.jobs.length + 1);
    assert.equal(next.jobs[0].title, "Data Analyst");
    assert.equal(next.jobs[0].code, nextJobCode(s.jobs));
    assert.equal(next.jobs[0].code, "MJ-1025");
    assert.equal(next.activity[0].title, "Job opening created");
    assert.deepEqual(next.jobs[0].requirements.map((r) => r.label), ["2+ years of data analysis", "SQL"]);
    assert.deepEqual(liveChannels(next.jobs[0]), ["MyJobMag", "LinkedIn"]);
  });

  it("filters jobs by text, status and department", () => {
    const { jobs } = fresh();
    assert.deepEqual(filterJobs(jobs, { query: "frontend" }).map((j) => j.code), ["MJ-1023"]);
    assert.equal(filterJobs(jobs, { status: "Draft" }).length, 1);
    assert.equal(filterJobs(jobs, { department: "Sales" })[0].title, "Sales Executive");
    assert.equal(filterJobs(jobs, { query: "zzz" }).length, 0);
  });

  it("changes job status", () => {
    const s = fresh();
    const next = run(s, { type: "job/setStatus", id: "x", at, jobId: "job-1019", status: "Open" });
    assert.equal(next.jobs.find((j) => j.id === "job-1019")?.status, "Open");
  });
});

describe("candidates and stages", () => {
  it("adds a candidate at the chosen stage with history", () => {
    const s = fresh();
    const next = run(s, {
      type: "candidate/add",
      id: "cand-new",
      at,
      input: { name: "Test Person", email: "test.person@example.com", phone: "", jobId: "job-1024", stage: "Screening", cvStatus: "Received", source: "Referral", note: "Referred" },
    });
    const c = next.candidates[0];
    assert.equal(c.stage, "Screening");
    assert.deepEqual(c.stageHistory.map((h) => h.to), ["Applied", "Screening"]);
    assert.equal(c.notes[0].text, "Referred");
    assert.equal(applicationCount(next.candidates, "job-1024"), applicationCount(s.candidates, "job-1024") + 1);
  });

  it("puts candidates without a role into the talent pool", () => {
    const s = fresh();
    const next = run(s, {
      type: "candidate/add",
      id: "cand-pool",
      at,
      input: { name: "Pool Person", email: "pool@example.com", phone: "", jobId: null, stage: "Applied", cvStatus: "Received", source: "Added manually" },
    });
    assert.ok(talentPool(next.candidates).some((c) => c.id === "cand-pool"));
  });

  it("moves a candidate between stages and records who did it", () => {
    const s = fresh();
    const amaka = byName(s, "Amaka Okafor");
    const next = run(s, { type: "candidate/moveStage", id: "m1", at, by: "Grace Nwosu", candidateId: amaka.id, to: "Screening" });
    const updated = byName(next, "Amaka Okafor");
    assert.equal(updated.stage, "Screening");
    assert.equal(updated.cvStatus, "Reviewed");
    assert.deepEqual(updated.stageHistory.at(-1), { from: "Applied", to: "Screening", at, by: "Grace Nwosu" });
    assert.equal(next.activity[0].title, "Moved to Screening");
  });

  it("does nothing when moving to the current stage", () => {
    const s = fresh();
    const amaka = byName(s, "Amaka Okafor");
    assert.equal(run(s, { type: "candidate/moveStage", id: "m", at, candidateId: amaka.id, to: "Applied" }), s);
  });

  it("starts an offer draft on reaching Offer and marks it accepted on Hired", () => {
    let s = fresh();
    const zainab = byName(s, "Zainab Yusuf");
    s = run(s, { type: "candidate/moveStage", id: "a", at, candidateId: zainab.id, to: "Offer" });
    assert.equal(byName(s, "Zainab Yusuf").offerStatus, "Draft");
    s = run(s, { type: "candidate/moveStage", id: "b", at, candidateId: zainab.id, to: "Hired" });
    assert.equal(byName(s, "Zainab Yusuf").offerStatus, "Accepted");
  });

  it("never changes stage when an offer is declined (a person decides)", () => {
    const s = fresh();
    const samuel = byName(s, "Samuel Adeyemi");
    const next = run(s, { type: "candidate/setOfferStatus", id: "o", at, candidateId: samuel.id, offerStatus: "Declined" });
    assert.equal(byName(next, "Samuel Adeyemi").stage, "Offer");
    assert.equal(nextAction(byName(next, "Samuel Adeyemi")), "Offer declined — decide next step");
  });

  it("clamps ratings to 0–5", () => {
    const s = fresh();
    const amaka = byName(s, "Amaka Okafor");
    assert.equal(byName(run(s, { type: "candidate/rate", id: "r", at, candidateId: amaka.id, rating: 9 }), "Amaka Okafor").rating, 5);
    assert.equal(byName(run(s, { type: "candidate/rate", id: "r", at, candidateId: amaka.id, rating: -2 }), "Amaka Okafor").rating, 0);
  });

  it("ignores empty notes", () => {
    const s = fresh();
    const amaka = byName(s, "Amaka Okafor");
    assert.equal(run(s, { type: "candidate/addNote", id: "n", at, candidateId: amaka.id, text: "   " }), s);
  });
});

describe("interviews", () => {
  it("schedules an interview and optionally moves the candidate to Interview", () => {
    const s = fresh();
    const zainab = byName(s, "Zainab Yusuf");
    const input = { scheduledFor: "2026-10-14T09:00:00.000Z", mode: "Video call" as const, interviewers: "Grace", location: "Link", moveToInterviewStage: true };
    const moved = run(s, { type: "candidate/scheduleInterview", id: "i1", at, candidateId: zainab.id, input });
    assert.equal(byName(moved, "Zainab Yusuf").stage, "Interview");
    assert.equal(byName(moved, "Zainab Yusuf").interviews.length, 1);

    const kept = run(s, { type: "candidate/scheduleInterview", id: "i2", at, candidateId: zainab.id, input: { ...input, moveToInterviewStage: false } });
    assert.equal(byName(kept, "Zainab Yusuf").stage, "Shortlisted");
  });

  it("does not schedule interviews for rejected candidates", () => {
    const s = fresh();
    const chinedu = byName(s, "Chinedu Ibe");
    const input = { scheduledFor: "2026-10-14T09:00:00.000Z", mode: "Phone" as const, interviewers: "Grace", location: "", moveToInterviewStage: true };
    assert.equal(run(s, { type: "candidate/scheduleInterview", id: "i", at, candidateId: chinedu.id, input }), s);
  });
});

describe("convert to employee", () => {
  const input = { department: "People Operations" as const, jobTitle: "HR Associate", location: "Lagos", startDate: "2026-11-02" };

  it("creates an employee only for hired candidates", () => {
    const s = fresh();
    const tunde = byName(s, "Tunde Mohammed"); // at Interview
    assert.equal(run(s, { type: "candidate/convertToEmployee", id: "e0", at, candidateId: tunde.id, input }), s);

    const yetunde = byName(s, "Yetunde Bakare"); // Hired
    const next = run(s, { type: "candidate/convertToEmployee", id: "emp-new", at, candidateId: yetunde.id, input });
    assert.equal(next.employees.length, s.employees.length + 1);
    assert.equal(next.employees[0].source, "Converted from candidate");
    assert.equal(next.employees[0].status, "Onboarding");
    assert.equal(byName(next, "Yetunde Bakare").convertedToEmployeeId, "emp-new");
  });

  it("does not convert the same candidate twice", () => {
    const s = fresh();
    const yetunde = byName(s, "Yetunde Bakare");
    const once = run(s, { type: "candidate/convertToEmployee", id: "e1", at, candidateId: yetunde.id, input });
    const twice = run(once, { type: "candidate/convertToEmployee", id: "e2", at, candidateId: yetunde.id, input });
    assert.equal(twice, once);
  });
});

describe("talent pool", () => {
  it("assigns a pool candidate to an open job, restarting at Applied", () => {
    const s = fresh();
    const segun = byName(s, "Segun Afolabi"); // Rejected, in pool
    const next = run(s, { type: "candidate/assignToJob", id: "t", at, candidateId: segun.id, jobId: "job-1024" });
    const updated = byName(next, "Segun Afolabi");
    assert.equal(updated.jobId, "job-1024");
    assert.equal(updated.stage, "Applied");
    assert.equal(updated.inTalentPool, false);
  });
});

describe("selectors", () => {
  it("counts candidates per stage, optionally per job", () => {
    const { candidates } = fresh();
    const all = pipelineCounts(candidates);
    assert.equal(Object.values(all).reduce((a, b) => a + b, 0), candidates.length);
    const fe = pipelineCounts(candidates, "job-1023");
    assert.equal(fe.Interview, 1);
    assert.equal(fe.Applied, 1);
  });

  it("builds a non-increasing funnel", () => {
    const funnel = funnelCounts(fresh().candidates);
    for (let i = 1; i < funnel.length; i++) assert.ok(funnel[i].reached <= funnel[i - 1].reached);
    assert.equal(funnel[0].reached, fresh().candidates.length);
  });

  it("filters candidates by search, job and stage", () => {
    const { candidates, jobs } = fresh();
    assert.deepEqual(filterCandidates(candidates, jobs, { query: "amaka" }).map((c) => c.name), ["Amaka Okafor"]);
    assert.ok(filterCandidates(candidates, jobs, { query: "frontend" }).length >= 3, "search matches role title");
    assert.ok(filterCandidates(candidates, jobs, { jobId: "job-1023" }).every((c) => c.jobId === "job-1023"));
    assert.ok(filterCandidates(candidates, jobs, { stage: "active" }).every((c) => !["Hired", "Rejected", "Withdrawn"].includes(c.stage)));
    assert.ok(filterCandidates(candidates, jobs, { stage: "Rejected" }).every((c) => c.stage === "Rejected"));
  });
});

describe("multi-channel publishing", () => {
  it("publishes a draft to chosen channels and opens it", () => {
    const s = fresh();
    const next = run(s, { type: "job/publish", id: "p", at, jobId: "job-1019", channels: ["MyJobMag", "WhatsApp"] });
    const job = next.jobs.find((j) => j.id === "job-1019")!;
    assert.equal(job.status, "Open");
    assert.deepEqual(liveChannels(job), ["MyJobMag", "WhatsApp"]);
    assert.equal(next.activity[0].title, "Vacancy published");
  });

  it("takes an advert down when a channel is unticked, keeping its history", () => {
    const s = fresh();
    const next = run(s, { type: "job/publish", id: "p", at, jobId: "job-1023", channels: ["MyJobMag"] });
    const job = next.jobs.find((j) => j.id === "job-1023")!;
    assert.deepEqual(liveChannels(job), ["MyJobMag"]);
    assert.equal(job.channels.LinkedIn?.status, "Removed");
  });

  it("removes every advert when a vacancy is closed", () => {
    const s = fresh();
    const next = run(s, { type: "job/setStatus", id: "c", at, jobId: "job-1024", status: "Closed" });
    assert.deepEqual(liveChannels(next.jobs.find((j) => j.id === "job-1024")!), []);
  });

  it("counts applicants by source", () => {
    const counts = sourceCounts(fresh().candidates);
    assert.equal(counts[0].source, "MyJobMag");
    assert.equal(counts.reduce((n, c) => n + c.count, 0), fresh().candidates.length);
  });
});

describe("CV database sourcing", () => {
  it("adds a database profile to a pipeline once, with its CV details", () => {
    const s = fresh();
    const p = s.talentDb[0];
    const once = run(s, { type: "talent/addToPipeline", id: "src-1", at, profileId: p.id, jobId: "job-1023" });
    const c = once.candidates[0];
    assert.equal(c.name, p.name);
    assert.equal(c.source, "MyJobMag CV database");
    assert.deepEqual(c.profile.skills, p.skills);
    const twice = run(once, { type: "talent/addToPipeline", id: "src-2", at, profileId: p.id, jobId: "job-1023" });
    assert.equal(twice, once);
  });

  it("records an invitation once per job", () => {
    const s = fresh();
    const p = s.talentDb[1];
    const once = run(s, { type: "talent/invite", id: "i1", at, profileId: p.id, jobId: "job-1023" });
    assert.equal(once.invitations.length, 1);
    assert.equal(run(once, { type: "talent/invite", id: "i2", at, profileId: p.id, jobId: "job-1023" }), once);
  });
});

describe("explainable matching", () => {
  const profile = { headline: "Frontend Engineer", skills: ["React", "TypeScript", "Accessibility"], yearsExperience: 2, location: "Abuja", education: "" };

  it("shows the CV evidence for a skill", () => {
    const m = matchRequirement({ id: "r", label: "Accessibility (WCAG)" }, profile);
    assert.equal(m.status, "found");
    assert.match(m.evidence, /Accessibility/);
  });

  it("compares years of experience and says what it compared", () => {
    const m = matchRequirement({ id: "r", label: "3+ years of frontend development" }, profile);
    assert.equal(m.status, "not-found");
    assert.match(m.evidence, /2 years.*3\+/);
  });

  it("checks location requirements", () => {
    assert.equal(matchRequirement({ id: "r", label: "Based in or near Abuja" }, profile).status, "found");
    assert.equal(matchRequirement({ id: "r", label: "Based in or near Lagos" }, profile).status, "not-found");
  });

  it("phrases missing items neutrally, as something to ask about", () => {
    const m = matchRequirement({ id: "r", label: "GraphQL" }, profile);
    assert.equal(m.status, "not-found");
    assert.match(m.evidence, /Ask at screening/);
  });

  it("returns one line per requirement and never a total score", () => {
    const out = matchProfile([{ id: "a", label: "React" }, { id: "b", label: "Go" }], profile);
    assert.equal(out.length, 2);
    assert.ok(out.every((o) => !("score" in o)));
  });

  it("parses requirement lines from the job form", () => {
    assert.deepEqual(parseRequirementLines("- React\n• TypeScript\n\n1. Testing; Figma"), ["React", "TypeScript", "Testing", "Figma"]);
  });

  it("records reviewer verdicts and can clear them", () => {
    const s = fresh();
    const tunde = byName(s, "Tunde Mohammed");
    const reqId = s.jobs.find((j) => j.id === "job-1023")!.requirements[0].id;
    const a = run(s, { type: "candidate/reviewRequirement", id: "v", at, candidateId: tunde.id, requirementId: reqId, verdict: "confirmed" });
    assert.equal(byName(a, "Tunde Mohammed").requirementReviews[reqId], "confirmed");
    const b = run(a, { type: "candidate/reviewRequirement", id: "v", at, candidateId: tunde.id, requirementId: reqId, verdict: null });
    assert.equal(byName(b, "Tunde Mohammed").requirementReviews[reqId], undefined);
  });
});

describe("self-service inbox", () => {
  it("adds WhatsApp requests and updates their status", () => {
    const s = fresh();
    const a = run(s, { type: "inbox/add", id: "req-x", at, request: { from: "Grace Nwosu", role: "Employee", kind: "Payslip request", detail: "September 2026", status: "New" } });
    assert.equal(a.inbox[0].channel, "WhatsApp");
    const b = run(a, { type: "inbox/setStatus", id: "u", at, requestId: "req-x", status: "Sent" });
    assert.equal(b.inbox[0].status, "Sent");
  });
});
