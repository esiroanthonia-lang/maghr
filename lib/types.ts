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
  status: EmployeeStatus;
  source: "Seed" | "Converted from candidate" | "Added manually";
  phone: string;
  managerName: string;
  employmentType: EmploymentType;
  exitedOn: string | null;
}

export const EMPLOYEE_STATUSES = ["Active", "Onboarding", "Exited"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const LEAVE_TYPES = ["Annual", "Sick", "Maternity", "Paternity", "Compassionate", "Study", "Unpaid"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_STATUSES = ["Pending", "Approved", "Declined", "Cancelled"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  days: number; // working days
  reason: string;
  status: LeaveStatus;
  decidedBy: string;
  decidedAt: string | null;
  createdAt: string;
}

export const GOAL_DEPARTMENTS = ["Company", "Engineering", "People Operations", "Sales", "Product & Design", "Marketing", "Finance"] as const;
export type GoalDepartment = (typeof GOAL_DEPARTMENTS)[number];

export interface Goal {
  id: string;
  title: string;
  ownerName: string;
  department: GoalDepartment;
  dueDate: string;
  progress: number; // 0–100
  createdAt: string;
}

export const REVIEW_STATUSES = ["Not started", "Self review", "Manager review", "Completed"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface Review {
  id: string;
  employeeId: string;
  cycle: string;
  status: ReviewStatus;
  rating: number | null;
  summary: string;
  reviewerName: string;
  updatedAt: string;
}

export const PAYROLL_STATUSES = ["Draft", "Pending approval", "Approved"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export interface PayrollRun {
  id: string;
  period: string; // YYYY-MM
  status: PayrollStatus;
  employeeCount: number;
  grossTotal: number;
  preparedBy: string;
  approvedBy: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface CompanySettings {
  companyName: string;
  leaveAllowanceDays: number;
}

export type ActivityKind = "application" | "stage" | "interview" | "offer" | "job" | "employee" | "note" | "publish" | "sourcing" | "whatsapp" | "leave" | "performance" | "payroll" | "settings";

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
}
