// Pure recruitment logic: state transitions and selectors.
// No I/O and no randomness here — callers pass ids and timestamps in,
// which keeps this file easy to unit test and easy to move server-side later.
//
// Fairness note: nothing in this module rejects or advances a candidate on its
// own. Every stage change is an explicit action taken by a person.

import type { DemoState } from "./demo-data";
import {
  ALL_STAGES,
  CHANNELS,
  type CandidateSource,
  type Channel,
  type ReviewVerdict,
  type SelfServiceRequest,
  PIPELINE_STAGES,
  type Activity,
  type Candidate,
  type CvStatus,
  type Department,
  type Employee,
  type EmploymentType,
  type InterviewMode,
  type Job,
  type JobStatus,
  type OfferStatus,
  type Stage,
} from "./types";

export type RecruitmentState = DemoState;

/** Every action carries the id to use for anything it creates, and the time it happened. */
interface Meta {
  id: string;
  at: string;
  by?: string;
}

export interface NewJobInput {
  title: string;
  department: Department;
  location: string;
  employmentType: EmploymentType;
  owner: string;
  description: string;
  status: JobStatus;
  /** One requirement per entry. */
  requirements: string[];
  /** Channels to advertise on straight away (Open roles only). */
  channels: Channel[];
}

export interface NewCandidateInput {
  name: string;
  email: string;
  phone: string;
  jobId: string | null;
  stage: Stage;
  cvStatus: CvStatus;
  source: CandidateSource;
  note?: string;
}

export interface InterviewInput {
  scheduledFor: string;
  mode: InterviewMode;
  interviewers: string;
  location: string;
  moveToInterviewStage: boolean;
}

export interface ConvertInput {
  department: Department;
  jobTitle: string;
  location: string;
  startDate: string;
}

export type RecruitmentAction =
  | ({ type: "job/add"; input: NewJobInput } & Meta)
  | ({ type: "job/setStatus"; jobId: string; status: JobStatus } & Meta)
  | ({ type: "candidate/add"; input: NewCandidateInput } & Meta)
  | ({ type: "candidate/moveStage"; candidateId: string; to: Stage } & Meta)
  | ({ type: "candidate/rate"; candidateId: string; rating: number } & Meta)
  | ({ type: "candidate/addNote"; candidateId: string; text: string } & Meta)
  | ({ type: "candidate/setCvStatus"; candidateId: string; cvStatus: CvStatus } & Meta)
  | ({ type: "candidate/scheduleInterview"; candidateId: string; input: InterviewInput } & Meta)
  | ({ type: "candidate/setInterviewStatus"; candidateId: string; interviewId: string; status: "Completed" | "Cancelled" } & Meta)
  | ({ type: "candidate/setOfferStatus"; candidateId: string; offerStatus: OfferStatus } & Meta)
  | ({ type: "candidate/setTalentPool"; candidateId: string; inTalentPool: boolean } & Meta)
  | ({ type: "candidate/convertToEmployee"; candidateId: string; input: ConvertInput } & Meta)
  | ({ type: "candidate/assignToJob"; candidateId: string; jobId: string } & Meta)
  | ({ type: "job/publish"; jobId: string; channels: Channel[] } & Meta)
  | ({ type: "talent/invite"; profileId: string; jobId: string } & Meta)
  | ({ type: "talent/addToPipeline"; profileId: string; jobId: string } & Meta)
  | ({ type: "candidate/reviewRequirement"; candidateId: string; requirementId: string; verdict: ReviewVerdict | null } & Meta)
  | ({ type: "inbox/add"; request: Omit<SelfServiceRequest, "id" | "at" | "channel"> } & Meta)
  | ({ type: "inbox/setStatus"; requestId: string; status: SelfServiceRequest["status"] } & Meta)
  | { type: "reset"; state: RecruitmentState };

const DEFAULT_ACTOR = "HR Admin";

export function stageIndex(stage: Stage): number {
  return ALL_STAGES.indexOf(stage);
}

export function isClosedStage(stage: Stage): boolean {
  return stage === "Rejected" || stage === "Withdrawn";
}

export function isActiveCandidate(c: Candidate): boolean {
  return !isClosedStage(c.stage) && c.stage !== "Hired";
}

export function nextJobCode(jobs: Job[]): string {
  const max = jobs.reduce((m, j) => {
    const n = Number(j.code.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  return `MJ-${max + 1}`;
}

function logActivity(state: RecruitmentState, entry: Activity): Activity[] {
  return [entry, ...state.activity].slice(0, 50);
}

function updateCandidate(
  state: RecruitmentState,
  candidateId: string,
  fn: (c: Candidate) => Candidate,
): Candidate[] {
  return state.candidates.map((c) => (c.id === candidateId ? fn(c) : c));
}

function removeAll(channels: Job["channels"]): Job["channels"] {
  const out: Job["channels"] = {};
  for (const c of CHANNELS) {
    const cur = channels[c];
    if (cur) out[c] = { ...cur, status: "Removed" };
  }
  return out;
}

function jobTitle(state: RecruitmentState, jobId: string | null): string {
  if (!jobId) return "Talent pool";
  return state.jobs.find((j) => j.id === jobId)?.title ?? "Unknown role";
}

function withStage(c: Candidate, to: Stage, at: string, by: string): Candidate {
  if (c.stage === to) return c;
  let offerStatus = c.offerStatus;
  if (to === "Offer" && offerStatus === "Not started") offerStatus = "Draft";
  if (to === "Hired") offerStatus = "Accepted";
  return {
    ...c,
    stage: to,
    offerStatus,
    cvStatus: c.cvStatus === "Received" && stageIndex(to) > 0 && !isClosedStage(to) ? "Reviewed" : c.cvStatus,
    stageHistory: [...c.stageHistory, { from: c.stage, to, at, by }],
    updatedAt: at,
  };
}

export function recruitmentReducer(state: RecruitmentState, action: RecruitmentAction): RecruitmentState {
  if (action.type === "reset") return action.state;
  const by = action.by ?? DEFAULT_ACTOR;

  switch (action.type) {
    case "job/add": {
      const { requirements, channels, ...rest } = action.input;
      const job: Job = {
        id: action.id,
        code: nextJobCode(state.jobs),
        ...rest,
        title: rest.title.trim(),
        createdAt: action.at,
        requirements: requirements.map((label, i) => ({ id: `${action.id}-r${i + 1}`, label })),
        channels:
          rest.status === "Open"
            ? Object.fromEntries(channels.map((c) => [c, { status: "Live" as const, publishedAt: action.at }]))
            : {},
      };
      return {
        ...state,
        jobs: [job, ...state.jobs],
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "job",
          title: job.status === "Draft" ? "Draft vacancy saved" : "Job opening created",
          detail:
            job.status === "Open" && channels.length
              ? `${job.title} · published to ${channels.join(", ")}`
              : `${job.title} · ${job.department}`,
          at: action.at,
        }),
      };
    }

    case "job/setStatus": {
      const job = state.jobs.find((j) => j.id === action.jobId);
      if (!job || job.status === action.status) return state;
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.jobId
            ? {
                ...j,
                status: action.status,
                // Closing a vacancy takes its adverts down everywhere.
                channels: action.status === "Closed" ? removeAll(j.channels) : j.channels,
              }
            : j,
        ),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "job",
          title: `Vacancy marked ${action.status.toLowerCase()}`,
          detail: job.title,
          at: action.at,
        }),
      };
    }

    case "candidate/add": {
      const { input } = action;
      const history: Candidate["stageHistory"] = [{ from: null, to: "Applied", at: action.at, by }];
      if (input.stage !== "Applied") history.push({ from: "Applied", to: input.stage, at: action.at, by });
      const candidate: Candidate = {
        id: action.id,
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        jobId: input.jobId,
        cvStatus: input.cvStatus,
        stage: input.stage,
        rating: 0,
        notes: input.note?.trim()
          ? [{ id: `note-${action.id}`, text: input.note.trim(), author: by, createdAt: action.at }]
          : [],
        interviews: [],
        offerStatus: input.stage === "Offer" ? "Draft" : input.stage === "Hired" ? "Accepted" : "Not started",
        inTalentPool: input.jobId === null,
        convertedToEmployeeId: null,
        stageHistory: history,
        source: input.source,
        profile: { headline: "", skills: [], yearsExperience: 0, location: "", education: "" },
        requirementReviews: {},
        sourcedProfileId: null,
        createdAt: action.at,
        updatedAt: action.at,
      };
      return {
        ...state,
        candidates: [candidate, ...state.candidates],
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "application",
          title: input.jobId ? "Candidate added" : "Added to talent pool",
          detail: `${candidate.name} · ${jobTitle(state, input.jobId)}`,
          at: action.at,
        }),
      };
    }

    case "candidate/moveStage": {
      const c = state.candidates.find((x) => x.id === action.candidateId);
      if (!c || c.stage === action.to) return state;
      return {
        ...state,
        candidates: updateCandidate(state, c.id, (x) => withStage(x, action.to, action.at, by)),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "stage",
          title: `Moved to ${action.to}`,
          detail: `${c.name} · ${jobTitle(state, c.jobId)}`,
          at: action.at,
        }),
      };
    }

    case "candidate/rate": {
      const rating = Math.max(0, Math.min(5, Math.round(action.rating)));
      return {
        ...state,
        candidates: updateCandidate(state, action.candidateId, (c) => ({ ...c, rating, updatedAt: action.at })),
      };
    }

    case "candidate/addNote": {
      const text = action.text.trim();
      const c = state.candidates.find((x) => x.id === action.candidateId);
      if (!text || !c) return state;
      return {
        ...state,
        candidates: updateCandidate(state, c.id, (x) => ({
          ...x,
          notes: [{ id: action.id, text, author: by, createdAt: action.at }, ...x.notes],
          updatedAt: action.at,
        })),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "note",
          title: "Note added",
          detail: `${c.name} · ${jobTitle(state, c.jobId)}`,
          at: action.at,
        }),
      };
    }

    case "candidate/setCvStatus":
      return {
        ...state,
        candidates: updateCandidate(state, action.candidateId, (c) => ({
          ...c,
          cvStatus: action.cvStatus,
          updatedAt: action.at,
        })),
      };

    case "candidate/scheduleInterview": {
      const c = state.candidates.find((x) => x.id === action.candidateId);
      if (!c || isClosedStage(c.stage)) return state;
      const { moveToInterviewStage, ...rest } = action.input;
      const shouldMove = moveToInterviewStage && stageIndex(c.stage) < stageIndex("Interview");
      return {
        ...state,
        candidates: updateCandidate(state, c.id, (x) => {
          const withInterview: Candidate = {
            ...x,
            interviews: [...x.interviews, { id: action.id, status: "Scheduled", ...rest }],
            updatedAt: action.at,
          };
          return shouldMove ? withStage(withInterview, "Interview", action.at, by) : withInterview;
        }),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "interview",
          title: "Interview scheduled",
          detail: `${c.name} · ${jobTitle(state, c.jobId)}`,
          at: action.at,
        }),
      };
    }

    case "candidate/setInterviewStatus":
      return {
        ...state,
        candidates: updateCandidate(state, action.candidateId, (c) => ({
          ...c,
          interviews: c.interviews.map((i) => (i.id === action.interviewId ? { ...i, status: action.status } : i)),
          updatedAt: action.at,
        })),
      };

    case "candidate/setOfferStatus": {
      const c = state.candidates.find((x) => x.id === action.candidateId);
      if (!c || c.offerStatus === action.offerStatus) return state;
      return {
        ...state,
        candidates: updateCandidate(state, c.id, (x) => ({ ...x, offerStatus: action.offerStatus, updatedAt: action.at })),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "offer",
          title: `Offer ${action.offerStatus.toLowerCase()}`,
          detail: `${c.name} · ${jobTitle(state, c.jobId)}`,
          at: action.at,
        }),
      };
    }

    case "candidate/setTalentPool":
      return {
        ...state,
        candidates: updateCandidate(state, action.candidateId, (c) => ({
          ...c,
          inTalentPool: action.inTalentPool,
          updatedAt: action.at,
        })),
      };

    case "candidate/convertToEmployee": {
      const c = state.candidates.find((x) => x.id === action.candidateId);
      // Only a hired candidate who has not already been converted can become an employee.
      if (!c || c.stage !== "Hired" || c.convertedToEmployeeId) return state;
      const employee: Employee = {
        id: action.id,
        name: c.name,
        email: c.email,
        department: action.input.department,
        jobTitle: action.input.jobTitle.trim() || jobTitle(state, c.jobId),
        location: action.input.location.trim(),
        startDate: action.input.startDate,
        status: "Onboarding",
        source: "Converted from candidate",
        phone: c.phone,
        managerName: "",
        employmentType: state.jobs.find((j) => j.id === c.jobId)?.employmentType ?? "Full-time",
        exitedOn: null,
        exitReason: "",
        exitChecklist: [],
      };
      return {
        ...state,
        employees: [employee, ...state.employees],
        candidates: updateCandidate(state, c.id, (x) => ({
          ...x,
          convertedToEmployeeId: employee.id,
          updatedAt: action.at,
        })),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "employee",
          title: "Converted to employee",
          detail: `${c.name} · ${employee.jobTitle}`,
          at: action.at,
        }),
      };
    }

    case "candidate/assignToJob": {
      // Move a talent-pool candidate into a live vacancy. They restart at Applied for that role.
      const c = state.candidates.find((x) => x.id === action.candidateId);
      const job = state.jobs.find((j) => j.id === action.jobId);
      if (!c || !job || c.jobId === job.id) return state;
      return {
        ...state,
        candidates: updateCandidate(state, c.id, (x) => ({
          ...x,
          jobId: job.id,
          stage: "Applied",
          offerStatus: "Not started",
          inTalentPool: false,
          stageHistory: [...x.stageHistory, { from: x.stage, to: "Applied", at: action.at, by }],
          updatedAt: action.at,
        })),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "application",
          title: "Talent pool candidate considered",
          detail: `${c.name} · ${job.title}`,
          at: action.at,
        }),
      };
    }

    case "job/publish": {
      const job = state.jobs.find((j) => j.id === action.jobId);
      if (!job || job.status === "Closed") return state;
      const wanted = new Set(action.channels);
      const channels: Job["channels"] = {};
      for (const c of CHANNELS) {
        const current = job.channels[c];
        if (wanted.has(c)) channels[c] = current?.status === "Live" ? current : { status: "Live", publishedAt: action.at };
        else if (current) channels[c] = { ...current, status: "Removed" };
      }
      const added = action.channels.filter((c) => job.channels[c]?.status !== "Live");
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === job.id ? { ...j, channels, status: wanted.size ? "Open" : j.status } : j)),
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "publish",
          title: added.length ? "Vacancy published" : "Advert channels updated",
          detail: `${job.title}${added.length ? ` · ${added.join(", ")}` : ""}`,
          at: action.at,
        }),
      };
    }

    case "talent/invite": {
      const p = state.talentDb.find((x) => x.id === action.profileId);
      const job = state.jobs.find((j) => j.id === action.jobId);
      if (!p || !job) return state;
      if (state.invitations.some((i) => i.profileId === p.id && i.jobId === job.id)) return state;
      return {
        ...state,
        invitations: [{ id: action.id, profileId: p.id, jobId: job.id, at: action.at }, ...state.invitations],
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "sourcing",
          title: "Invited to apply",
          detail: `${p.name} · ${job.title}`,
          at: action.at,
        }),
      };
    }

    case "talent/addToPipeline": {
      const p = state.talentDb.find((x) => x.id === action.profileId);
      const job = state.jobs.find((j) => j.id === action.jobId);
      if (!p || !job) return state;
      if (state.candidates.some((c) => c.sourcedProfileId === p.id && c.jobId === job.id)) return state;
      const candidate: Candidate = {
        id: action.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        jobId: job.id,
        cvStatus: "Received",
        stage: "Applied",
        rating: 0,
        notes: [],
        interviews: [],
        offerStatus: "Not started",
        inTalentPool: false,
        convertedToEmployeeId: null,
        stageHistory: [{ from: null, to: "Applied", at: action.at, by }],
        source: "MyJobMag CV database",
        profile: {
          headline: p.headline,
          skills: [...p.skills],
          yearsExperience: p.yearsExperience,
          location: p.location,
          education: p.education,
        },
        requirementReviews: {},
        sourcedProfileId: p.id,
        createdAt: action.at,
        updatedAt: action.at,
      };
      return {
        ...state,
        candidates: [candidate, ...state.candidates],
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "sourcing",
          title: "Sourced from MyJobMag CV database",
          detail: `${p.name} · ${job.title}`,
          at: action.at,
        }),
      };
    }

    case "candidate/reviewRequirement":
      return {
        ...state,
        candidates: updateCandidate(state, action.candidateId, (c) => {
          const reviews = { ...c.requirementReviews };
          if (action.verdict) reviews[action.requirementId] = action.verdict;
          else delete reviews[action.requirementId];
          return { ...c, requirementReviews: reviews, updatedAt: action.at };
        }),
      };

    case "inbox/add":
      return {
        ...state,
        inbox: [{ id: action.id, at: action.at, channel: "WhatsApp", ...action.request }, ...state.inbox],
        activity: logActivity(state, {
          id: `act-${action.id}`,
          kind: "whatsapp",
          title: `WhatsApp: ${action.request.kind.toLowerCase()}`,
          detail: `${action.request.from} · ${action.request.detail}`,
          at: action.at,
        }),
      };

    case "inbox/setStatus":
      return {
        ...state,
        inbox: state.inbox.map((r) => (r.id === action.requestId ? { ...r, status: action.status } : r)),
      };

    default:
      return state;
  }
}

// ---------- Selectors ----------

export function applicationCount(candidates: Candidate[], jobId: string): number {
  return candidates.filter((c) => c.jobId === jobId).length;
}

export function pipelineCounts(candidates: Candidate[], jobId?: string | null): Record<Stage, number> {
  const counts = Object.fromEntries(ALL_STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const c of candidates) {
    if (jobId !== undefined && jobId !== null && c.jobId !== jobId) continue;
    counts[c.stage] += 1;
  }
  return counts;
}

/**
 * Funnel view: how many candidates have reached at least each pipeline stage.
 * A candidate currently at Interview has also passed Applied, Screening and Shortlisted.
 */
export function funnelCounts(candidates: Candidate[]): { stage: Stage; reached: number }[] {
  return PIPELINE_STAGES.map((stage) => {
    const idx = stageIndex(stage);
    const reached = candidates.filter((c) => {
      if (!isClosedStage(c.stage)) return stageIndex(c.stage) >= idx;
      // For closed candidates, count the furthest open stage they reached before closing.
      const furthest = c.stageHistory
        .map((h) => h.to)
        .filter((s) => !isClosedStage(s))
        .reduce((m, s) => Math.max(m, stageIndex(s)), 0);
      return furthest >= idx;
    }).length;
    return { stage, reached };
  });
}

export interface CandidateFilter {
  query?: string;
  jobId?: string | "all";
  stage?: Stage | "all" | "active";
}

export function filterCandidates(candidates: Candidate[], jobs: Job[], f: CandidateFilter): Candidate[] {
  const q = (f.query ?? "").trim().toLowerCase();
  return candidates.filter((c) => {
    if (f.jobId && f.jobId !== "all" && c.jobId !== f.jobId) return false;
    if (f.stage === "active" && !isActiveCandidate(c)) return false;
    if (f.stage && f.stage !== "all" && f.stage !== "active" && c.stage !== f.stage) return false;
    if (!q) return true;
    const role = c.jobId ? jobs.find((j) => j.id === c.jobId)?.title ?? "" : "talent pool";
    return [c.name, c.email, c.phone, role].some((v) => v.toLowerCase().includes(q));
  });
}

export interface JobFilter {
  query?: string;
  status?: JobStatus | "all";
  department?: Department | "all";
}

export function filterJobs(jobs: Job[], f: JobFilter): Job[] {
  const q = (f.query ?? "").trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.status && f.status !== "all" && j.status !== f.status) return false;
    if (f.department && f.department !== "all" && j.department !== f.department) return false;
    if (!q) return true;
    return [j.title, j.department, j.location, j.code, j.owner].some((v) => v.toLowerCase().includes(q));
  });
}

export function upcomingInterviews(state: RecruitmentState, now: Date) {
  const rows = state.candidates.flatMap((c) =>
    c.interviews.map((i) => ({ interview: i, candidate: c, job: state.jobs.find((j) => j.id === c.jobId) ?? null })),
  );
  return rows
    .filter((r) => r.interview.status === "Scheduled" && new Date(r.interview.scheduledFor).getTime() >= now.getTime() - 60 * 60 * 1000)
    .sort((a, b) => a.interview.scheduledFor.localeCompare(b.interview.scheduledFor));
}

export function talentPool(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => c.inTalentPool);
}

/** A plain-language suggestion for what a person should do next. Never acts on its own. */
export function nextAction(c: Candidate, now?: Date): string {
  switch (c.stage) {
    case "Applied":
      return c.cvStatus === "Missing" ? "Request CV" : "Review CV";
    case "Screening":
      return "Screening call";
    case "Shortlisted":
      return c.interviews.some((i) => i.status === "Scheduled") ? "Interview booked" : "Schedule interview";
    case "Interview": {
      const upcoming = c.interviews.find(
        (i) => i.status === "Scheduled" && (!now || new Date(i.scheduledFor).getTime() >= now.getTime()),
      );
      return upcoming ? "Interview booked" : "Collect feedback";
    }
    case "Offer":
      if (c.offerStatus === "Draft" || c.offerStatus === "Not started") return "Send offer";
      if (c.offerStatus === "Sent") return "Awaiting response";
      if (c.offerStatus === "Accepted") return "Move to Hired";
      return "Offer declined — decide next step";
    case "Hired":
      return c.convertedToEmployeeId ? "Onboarding" : "Convert to employee";
    default:
      return "—";
  }
}

export function liveChannels(job: Job): Channel[] {
  return CHANNELS.filter((c) => job.channels[c]?.status === "Live");
}

/** Applicants per source, most common first. Used to show which channels actually bring candidates. */
export function sourceCounts(candidates: Candidate[], jobId?: string): { source: CandidateSource; count: number }[] {
  const map = new Map<CandidateSource, number>();
  for (const c of candidates) {
    if (jobId && c.jobId !== jobId) continue;
    map.set(c.source, (map.get(c.source) ?? 0) + 1);
  }
  return [...map.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

