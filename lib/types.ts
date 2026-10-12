// Core domain types for MagHR (Phase 1 — frontend only, synthetic demo data).

export const PIPELINE_STAGES = [
  "Applied",
  "Screening",
  "Shortlisted",
  "Interview",
  "Offer",
  "Hired",
] as const;

export const CLOSED_STAGES = ["Rejected", "Withdrawn"] as const;

export const ALL_STAGES = [...PIPELINE_STAGES, ...CLOSED_STAGES] as const;

export type Stage = (typeof ALL_STAGES)[number];

export const DEPARTMENTS = [
  "Engineering",
  "People Operations",
  "Sales",
  "Product & Design",
  "Marketing",
  "Finance",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const JOB_STATUSES = ["Open", "Draft", "Closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface Job {
  id: string;
  code: string;
  title: string;
  department: Department;
  location: string;
  employmentType: EmploymentType;
  description: string;
  owner: string;
  status: JobStatus;
  createdAt: string; // ISO timestamp
  /** What the role needs, one line each, e.g. "3+ years of React". Used for the explainable match panel. */
  requirements: Requirement[];
  /** Where the vacancy is advertised. Demo only until channel integrations are approved. */
  channels: Partial<Record<Channel, ChannelListing>>;
}

export interface Requirement {
  id: string;
  label: string;
}

export const CHANNELS = ["MyJobMag", "Careers page", "LinkedIn", "WhatsApp"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface ChannelListing {
  status: "Live" | "Removed";
  publishedAt: string;
}

export const CANDIDATE_SOURCES = [
  "MyJobMag",
  "MyJobMag CV database",
  "Careers page",
  "LinkedIn",
  "WhatsApp",
  "Referral",
  "Added manually",
] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

/** Structured CV details. Synthetic in the demo; in production this would come from the applicant's MyJobMag profile. */
export interface CvProfile {
  headline: string;
  skills: string[];
  yearsExperience: number;
  location: string;
  education: string;
}

/** A job seeker in the MyJobMag CV database (synthetic). */
export interface TalentProfile extends CvProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastActive: string;
  openToWork: boolean;
}

export interface Invitation {
  id: string;
  profileId: string;
  jobId: string;
  at: string;
}

export type ReviewVerdict = "confirmed" | "disputed";

export const REQUEST_KINDS = ["Leave request", "Payslip request", "Application status", "Withdrawal"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** A request that arrived through a self-service channel (WhatsApp in the demo). */
export interface SelfServiceRequest {
  id: string;
  channel: "WhatsApp";
  from: string;
  role: "Employee" | "Candidate";
  kind: RequestKind;
  detail: string;
  status: "New" | "Approved" | "Declined" | "Sent" | "Answered automatically";
  at: string;
}

export const CV_STATUSES = ["Received", "Reviewed", "Missing"] as const;
export type CvStatus = (typeof CV_STATUSES)[number];

export const INTERVIEW_MODES = ["Video call", "In person", "Phone"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export interface Interview {
  id: string;
  scheduledFor: string; // ISO timestamp
  mode: InterviewMode;
  interviewers: string;
  location: string;
  status: "Scheduled" | "Completed" | "Cancelled";
}

export const OFFER_STATUSES = ["Not started", "Draft", "Sent", "Accepted", "Declined"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface Note {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface StageChange {
  from: Stage | null;
  to: Stage;
  at: string;
  by: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** null when the candidate is in the talent pool without a specific vacancy */
  jobId: string | null;
  cvStatus: CvStatus;
  stage: Stage;
  rating: number; // 0–5, set by a human reviewer
  notes: Note[];
  interviews: Interview[];
  offerStatus: OfferStatus;
  inTalentPool: boolean;
  convertedToEmployeeId: string | null;
  stageHistory: StageChange[];
  source: CandidateSource;
  profile: CvProfile;
  /** Reviewer sign-off on each requirement, keyed by requirement id. */
  requirementReviews: Record<string, ReviewVerdict>;
  sourcedProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: Department;
  jobTitle: string;
  location: string;
  startDate: string;
  status: "Active" | "Onboarding";
  source: "Seed" | "Converted from candidate" | "Added manually";
}

export type ActivityKind = "application" | "stage" | "interview" | "offer" | "job" | "employee" | "note" | "publish" | "sourcing" | "whatsapp";

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
}
