// SYNTHETIC DEMO DATA ONLY.
// Every name, email and phone number below is invented for the prototype.
// Do not replace these with real candidate or employee records.

import type { CompanyHoliday } from "./holidays";
import { lagosDate, lagosTime, lagosToIso, lastDays } from "./attendance";
import type { CareersSettings } from "./careers";
import { onboardingTemplate } from "./people";
import type {
  Activity,
  AttendanceRecord,
  Candidate,
  CandidateSource,
  CompanySettings,
  CvProfile,
  Goal,
  LeaveRequest,
  OnboardingTask,
  PayrollRun,
  Review,
  Employee,
  Invitation,
  Job,
  SelfServiceRequest,
  Stage,
  TalentProfile,
} from "./types";


export interface DemoState {
  jobs: Job[];
  candidates: Candidate[];
  employees: Employee[];
  activity: Activity[];
  talentDb: TalentProfile[];
  invitations: Invitation[];
  inbox: SelfServiceRequest[];
  /** Monthly gross pay in naira, by employee id. Only HR admins can see this in live mode. */
  pay: Record<string, number>;
  leave: LeaveRequest[];
  goals: Goal[];
  reviews: Review[];
  payrollRuns: PayrollRun[];
  settings: CompanySettings;
  /** Company-declared holidays (Eid, Mawlid, substitute days…). National fixed holidays are calculated. */
  holidays: CompanyHoliday[];
  onboarding: OnboardingTask[];
  attendance: AttendanceRecord[];
  /** Public careers page settings. Off by default in real workspaces. */
  careers: CareersSettings;
}

/** Requirements per seeded vacancy. Plain sentences; the match panel looks for CV skills inside them. */
const REQUIREMENTS: Record<string, string[]> = {
  "job-1024": ["3+ years of product design", "Figma", "User research", "Design systems", "Accessibility (WCAG)"],
  "job-1023": ["3+ years of frontend development", "React", "TypeScript", "Accessibility (WCAG)", "Testing"],
  "job-1022": ["2+ years in HR operations", "Onboarding", "HRIS", "Nigerian labour law"],
  "job-1021": ["2+ years of B2B sales", "Account management", "CRM", "Based in or near Abuja"],
  "job-1020": ["Content writing", "SEO", "Social media"],
  "job-1019": ["3+ years of payroll", "PAYE", "Pension remittance", "Excel"],
};

const PROFILES: Record<string, CvProfile & { source: CandidateSource }> = {
  "Amaka Okafor": { headline: "Product Designer", skills: ["Figma", "User research", "Prototyping", "Design systems"], yearsExperience: 4, location: "Lagos", education: "B.A. Fine & Applied Arts, UNN", source: "MyJobMag" },
  "Tunde Mohammed": { headline: "Frontend Engineer", skills: ["React", "TypeScript", "Next.js", "Testing", "Accessibility"], yearsExperience: 5, location: "Ilorin (remote)", education: "B.Eng. Computer Engineering, UNILORIN", source: "MyJobMag" },
  "Chika Eze": { headline: "HR Officer", skills: ["Onboarding", "Employee records", "HRIS", "Recruitment"], yearsExperience: 3, location: "Lagos", education: "B.Sc. Psychology, UNILAG", source: "Careers page" },
  "Samuel Adeyemi": { headline: "Sales Executive", skills: ["B2B sales", "Account management", "CRM", "Negotiation"], yearsExperience: 4, location: "Abuja", education: "B.Sc. Marketing, ABU Zaria", source: "Referral" },
  "Zainab Yusuf": { headline: "UI/UX Designer", skills: ["Figma", "Design systems", "Accessibility", "Prototyping"], yearsExperience: 3, location: "Kano (open to Lagos)", education: "B.Sc. Computer Science, BUK", source: "MyJobMag" },
  "Emeka Nnamdi": { headline: "Frontend Developer", skills: ["React", "JavaScript", "CSS"], yearsExperience: 2, location: "Enugu", education: "HND Computer Science, IMT Enugu", source: "LinkedIn" },
  "Bisi Ogunleye": { headline: "Software Developer", skills: ["Vue", "TypeScript", "Testing"], yearsExperience: 3, location: "Ibadan", education: "B.Sc. Computer Science, UI", source: "MyJobMag" },
  "Kelechi Uche": { headline: "Frontend Engineer", skills: ["React", "TypeScript", "Redux"], yearsExperience: 4, location: "Port Harcourt", education: "B.Eng. Electrical Engineering, UNIPORT", source: "MyJobMag" },
  "Halima Sani": { headline: "Business Development Officer", skills: ["B2B sales", "CRM", "Hausa (fluent)"], yearsExperience: 2, location: "Abuja", education: "B.Sc. Business Administration, UniAbuja", source: "WhatsApp" },
  "Ngozi Okonkwo": { headline: "HR Assistant", skills: ["Onboarding", "Payroll support"], yearsExperience: 1, location: "Lagos", education: "B.Sc. Industrial Relations, LASU", source: "MyJobMag" },
  "Olumide Adeleke": { headline: "Content Writer", skills: ["Content writing", "SEO", "Copywriting"], yearsExperience: 1, location: "Lagos", education: "B.A. English, OAU", source: "Careers page" },
  "Aisha Lawal": { headline: "Social Media Assistant", skills: ["Social media", "Canva", "Content writing"], yearsExperience: 1, location: "Lagos", education: "B.Sc. Mass Communication, UNILAG", source: "MyJobMag" },
  "Chinedu Ibe": { headline: "Graphic Designer", skills: ["Photoshop", "Illustrator", "Branding"], yearsExperience: 2, location: "Lagos", education: "ND Graphic Design, Yabatech", source: "MyJobMag" },
  "Yetunde Bakare": { headline: "HR Generalist", skills: ["Onboarding", "HRIS", "Nigerian labour law", "Employee relations"], yearsExperience: 5, location: "Lagos", education: "B.Sc. Sociology, UNILAG; ACIPM", source: "Referral" },
  "Ibrahim Musa": { headline: "Sales Representative", skills: ["Field sales", "CRM"], yearsExperience: 3, location: "Kaduna", education: "B.Sc. Economics, KASU", source: "MyJobMag" },
  "Funke Akindele-Obi": { headline: "Senior Product Designer", skills: ["Figma", "User research", "Design systems", "Accessibility"], yearsExperience: 7, location: "Lagos", education: "M.Sc. Human-Computer Interaction", source: "Referral" },
  "Segun Afolabi": { headline: "Frontend Developer", skills: ["React", "JavaScript", "Figma"], yearsExperience: 3, location: "Abeokuta", education: "B.Tech. Computer Science, FUNAAB", source: "LinkedIn" },
};

function toProfile(p: CvProfile | undefined): CvProfile {
  if (!p) return { headline: "", skills: [], yearsExperience: 0, location: "", education: "" };
  return { headline: p.headline, skills: [...p.skills], yearsExperience: p.yearsExperience, location: p.location, education: p.education };
}

/** Synthetic slice of the MyJobMag CV database, for the sourcing demo. */
function talentDatabase(ago: (ms: number) => string): TalentProfile[] {
  const rows: [string, string, string[], number, string, string, number, boolean][] = [
    ["Adaeze Nwachukwu", "Frontend Engineer", ["React", "TypeScript", "Accessibility", "Testing"], 4, "Lagos", "B.Sc. Computer Science, UNN", 1, true],
    ["Musa Abdullahi", "Full-stack Developer", ["Node.js", "React", "PostgreSQL"], 6, "Abuja", "B.Eng. Software Engineering, FUTMinna", 3, true],
    ["Tobi Ajayi", "Frontend Developer", ["Vue", "JavaScript", "CSS"], 2, "Ibadan", "B.Sc. Computer Science, LAUTECH", 10, true],
    ["Blessing Etim", "Product Designer", ["Figma", "User research", "Design systems"], 5, "Uyo (remote)", "B.A. Fine Arts, UNIUYO", 2, true],
    ["Femi Oladipo", "UX Researcher", ["User research", "Usability testing", "Figma"], 3, "Lagos", "M.Sc. Psychology, UNILAG", 6, false],
    ["Hauwa Garba", "HR Officer", ["Onboarding", "HRIS", "Nigerian labour law"], 3, "Kaduna", "B.Sc. Business Admin, ABU; ACIPM", 1, true],
    ["Ikechukwu Obi", "HR Generalist", ["Employee relations", "Onboarding", "Recruitment"], 6, "Lagos", "B.Sc. Industrial Relations, UNILAG", 4, true],
    ["Kemi Ojo", "Payroll Officer", ["Payroll", "PAYE", "Pension remittance", "Excel"], 4, "Lagos", "B.Sc. Accounting, OAU; ICAN", 2, true],
    ["Nnamdi Eze", "Accounts Officer", ["Excel", "Payroll", "Reconciliation"], 3, "Enugu", "HND Accountancy, IMT", 14, true],
    ["Rukayat Bello", "Sales Executive", ["B2B sales", "Account management", "CRM"], 3, "Abuja", "B.Sc. Marketing, UniAbuja", 1, true],
    ["Daniel Okon", "Key Account Manager", ["Account management", "Negotiation", "CRM"], 7, "Port Harcourt", "MBA, UNIPORT", 5, false],
    ["Chioma Agu", "Content Strategist", ["Content writing", "SEO", "Social media"], 2, "Lagos", "B.A. English, UNN", 3, true],
    ["Yusuf Danjuma", "Digital Marketing Intern", ["Social media", "Canva"], 0, "Jos", "B.Sc. Mass Communication, UNIJOS", 7, true],
    ["Grace Adebisi", "QA Engineer", ["Testing", "Cypress", "TypeScript"], 3, "Lagos", "B.Sc. Computer Science, Covenant", 2, true],
  ];
  return rows.map(([name, headline, skills, years, location, education, activeDaysAgo, openToWork], i) => ({
    id: `tal-${String(i + 1).padStart(3, "0")}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    phone: `+234 800 111 ${String(2000 + i).slice(-4)}`,
    headline,
    skills,
    yearsExperience: years,
    location,
    education,
    lastActive: ago(activeDaysAgo * DAY),
    openToWork,
  }));
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function createDemoData(now: Date = new Date()): DemoState {
  const t = now.getTime();
  const ago = (ms: number) => new Date(t - ms).toISOString();
  // A whole-hour slot N days from now, in Lagos time (UTC+1), so seeded interviews look realistic.
  const slot = (days: number, lagosHour: number) => {
    const d = new Date(t + days * DAY);
    d.setUTCHours(lagosHour - 1, 0, 0, 0);
    return d.toISOString();
  };

  const baseJobs: Omit<Job, "requirements" | "channels">[] = [
    {
      id: "job-1024",
      code: "MJ-1024",
      title: "Product Designer",
      department: "Product & Design",
      location: "Lagos / Hybrid",
      employmentType: "Full-time",
      description:
        "Design clear, accessible flows for employers and job seekers. Work closely with engineering and research.",
      owner: "Grace Nwosu",
      status: "Open",
      createdAt: ago(6 * DAY),
    },
    {
      id: "job-1023",
      code: "MJ-1023",
      title: "Frontend Engineer",
      department: "Engineering",
      location: "Remote",
      employmentType: "Full-time",
      description: "Build and maintain the MagHR web app using TypeScript and React.",
      owner: "Daniel Adebayo",
      status: "Open",
      createdAt: ago(3 * DAY),
    },
    {
      id: "job-1022",
      code: "MJ-1022",
      title: "HR Associate",
      department: "People Operations",
      location: "Lagos",
      employmentType: "Full-time",
      description: "Support onboarding, employee records and leave administration.",
      owner: "Grace Nwosu",
      status: "Open",
      createdAt: ago(8 * DAY),
    },
    {
      id: "job-1021",
      code: "MJ-1021",
      title: "Sales Executive",
      department: "Sales",
      location: "Abuja / On-site",
      employmentType: "Full-time",
      description: "Grow employer accounts across the FCT and northern region.",
      owner: "Fatima Bello",
      status: "Open",
      createdAt: ago(12 * DAY),
    },
    {
      id: "job-1020",
      code: "MJ-1020",
      title: "Content Marketing Intern",
      department: "Marketing",
      location: "Lagos / Hybrid",
      employmentType: "Internship",
      description: "Write career-advice articles and help run social campaigns.",
      owner: "Ifeoma Obi",
      status: "Open",
      createdAt: ago(15 * DAY),
    },
    {
      id: "job-1019",
      code: "MJ-1019",
      title: "Payroll Officer",
      department: "Finance",
      location: "Lagos",
      employmentType: "Contract",
      description: "Draft vacancy — description to be confirmed with Finance.",
      owner: "Grace Nwosu",
      status: "Draft",
      createdAt: ago(1 * DAY),
    },
  ];

  const jobs: Job[] = baseJobs.map((j) => ({
    ...j,
    requirements: (REQUIREMENTS[j.id] ?? []).map((label, i) => ({ id: `${j.id}-r${i + 1}`, label })),
    channels:
      j.status === "Open"
        ? {
            MyJobMag: { status: "Live", publishedAt: j.createdAt },
            "Careers page": { status: "Live", publishedAt: j.createdAt },
            ...(j.id === "job-1023" ? { LinkedIn: { status: "Live" as const, publishedAt: j.createdAt } } : {}),
            ...(j.id === "job-1021" ? { WhatsApp: { status: "Live" as const, publishedAt: j.createdAt } } : {}),
          }
        : {},
  }));

  let seq = 0;
  const cand = (
    name: string,
    jobId: string | null,
    stage: Stage,
    rating: number,
    appliedAgo: number,
    extra: Partial<Candidate> = {},
  ): Candidate => {
    seq += 1;
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
    const createdAt = ago(appliedAgo);
    const history: Candidate["stageHistory"] = [{ from: null, to: "Applied", at: createdAt, by: "Applicant" }];
    if (stage !== "Applied") {
      history.push({ from: "Applied", to: stage, at: ago(Math.max(appliedAgo / 2, HOUR)), by: "HR Admin" });
    }
    return {
      id: `cand-${String(seq).padStart(3, "0")}`,
      name,
      email: `${slug}@example.com`,
      phone: `+234 800 000 ${String(1000 + seq).slice(-4)}`,
      jobId,
      cvStatus: stage === "Applied" ? "Received" : "Reviewed",
      stage,
      rating,
      notes: [],
      interviews: [],
      offerStatus: stage === "Offer" ? "Sent" : stage === "Hired" ? "Accepted" : "Not started",
      inTalentPool: false,
      convertedToEmployeeId: null,
      stageHistory: history,
      source: PROFILES[name]?.source ?? "Added manually",
      profile: toProfile(PROFILES[name]),
      requirementReviews: {},
      sourcedProfileId: null,
      createdAt,
      updatedAt: history[history.length - 1].at,
      ...extra,
    };
  };

  const candidates: Candidate[] = [
    cand("Amaka Okafor", "job-1024", "Applied", 0, 2 * HOUR),
    cand("Tunde Mohammed", "job-1023", "Interview", 5, 4 * DAY, {
      interviews: [
        {
          id: "int-001",
          scheduledFor: slot(1, 10),
          mode: "Video call",
          interviewers: "Daniel Adebayo, Grace Nwosu",
          location: "Google Meet link to be shared",
          status: "Scheduled",
        },
      ],
      notes: [
        {
          id: "note-001",
          text: "Strong take-home task. Ask about accessibility testing experience.",
          author: "Daniel Adebayo",
          createdAt: ago(1 * DAY),
        },
      ],
    }),
    cand("Chika Eze", "job-1022", "Screening", 4, 1 * DAY),
    cand("Samuel Adeyemi", "job-1021", "Offer", 4, 9 * DAY),
    cand("Zainab Yusuf", "job-1024", "Shortlisted", 4, 3 * DAY),
    cand("Emeka Nnamdi", "job-1023", "Screening", 3, 2 * DAY),
    cand("Bisi Ogunleye", "job-1023", "Applied", 0, 6 * HOUR),
    cand("Kelechi Uche", "job-1023", "Shortlisted", 4, 3 * DAY),
    cand("Halima Sani", "job-1021", "Interview", 3, 7 * DAY, {
      interviews: [
        {
          id: "int-002",
          scheduledFor: slot(2, 14),
          mode: "In person",
          interviewers: "Fatima Bello",
          location: "Abuja office",
          status: "Scheduled",
        },
      ],
    }),
    cand("Ngozi Okonkwo", "job-1022", "Applied", 0, 20 * HOUR, { cvStatus: "Missing" }),
    cand("Olumide Adeleke", "job-1020", "Applied", 0, 1 * DAY),
    cand("Aisha Lawal", "job-1020", "Screening", 3, 4 * DAY),
    cand("Chinedu Ibe", "job-1024", "Rejected", 2, 10 * DAY),
    cand("Yetunde Bakare", "job-1022", "Hired", 5, 14 * DAY),
    cand("Ibrahim Musa", "job-1021", "Withdrawn", 3, 11 * DAY),
    cand("Funke Akindele-Obi", null, "Applied", 4, 20 * DAY, {
      inTalentPool: true,
      notes: [
        {
          id: "note-002",
          text: "Great portfolio; no matching role right now. Revisit for senior design roles.",
          author: "Grace Nwosu",
          createdAt: ago(19 * DAY),
        },
      ],
    }),
    cand("Segun Afolabi", "job-1023", "Rejected", 3, 12 * DAY, { inTalentPool: true }),
  ];

  // Synthetic staff directory. emp-001…emp-004 are referenced elsewhere in the demo.
  const staff: [string, Employee["department"], string, string, string, string, number, Employee["status"]?][] = [
    ["Grace Nwosu", "People Operations", "HR Manager", "Lagos · Hybrid", "2022-03-01", "", 850000],
    ["Daniel Adebayo", "Engineering", "Software Engineer", "Remote", "2023-01-16", "Tobi Ogun", 900000],
    ["Fatima Bello", "Sales", "Sales Lead", "Abuja · On-site", "2021-07-05", "Grace Nwosu", 750000],
    ["Michael Ekanem", "Product & Design", "Product Designer", "Lagos · Hybrid", "2024-02-12", "Ifeoma Obi", 700000],
    ["Tobi Ogun", "Engineering", "Engineering Manager", "Lagos · Hybrid", "2020-09-14", "", 1400000],
    ["Ifeoma Obi", "Marketing", "Head of Marketing", "Lagos · Hybrid", "2021-04-19", "", 1100000],
    ["Peter James", "Finance", "Finance Officer", "Lagos · On-site", "2022-11-07", "Kunle Akande", 520000],
    ["Kunle Akande", "Finance", "Finance Manager", "Lagos · On-site", "2019-06-03", "", 1250000],
    ["Blessing Udo", "Sales", "Account Executive", "Port Harcourt · Field", "2023-05-22", "Fatima Bello", 480000],
    ["Musa Garba", "Sales", "Account Executive", "Kano · Field", "2024-08-05", "Fatima Bello", 460000],
    ["Chiamaka Obi", "Engineering", "QA Engineer", "Remote", "2023-10-02", "Tobi Ogun", 650000],
    ["Uche Okeke", "Engineering", "Backend Engineer", "Enugu · Remote", "2022-02-28", "Tobi Ogun", 950000],
    ["Sade Williams", "People Operations", "HR Associate", "Lagos · Hybrid", "2025-01-13", "Grace Nwosu", 380000],
    ["Ahmed Lawal", "Marketing", "Content Lead", "Abuja · Hybrid", "2023-03-06", "Ifeoma Obi", 560000],
    ["Kemi Adeyemi", "People Operations", "HR Generalist", "Lagos · Hybrid", "2026-10-27", "Grace Nwosu", 520000, "Onboarding"],
    ["Ruth Eze", "Product & Design", "UX Researcher", "Lagos · Hybrid", "2021-08-16", "Ifeoma Obi", 0, "Exited"],
  ];
  const employees: Employee[] = staff.map(([name, department, jobTitle, location, startDate, managerName, , status], i) => ({
    id: `emp-${String(i + 1).padStart(3, "0")}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    department,
    jobTitle,
    location,
    startDate,
    status: status ?? "Active",
    source: "Seed",
    phone: `+234 800 222 ${String(3000 + i).slice(-4)}`,
    managerName,
    employmentType: jobTitle.includes("Intern") ? "Internship" : "Full-time",
    exitedOn: status === "Exited" ? "2026-06-30" : null,
  }));
  const pay: Record<string, number> = Object.fromEntries(
    staff.map((row, i) => [`emp-${String(i + 1).padStart(3, "0")}`, row[6]] as const).filter(([, v]) => v > 0),
  );

  const today = new Date(t);
  const ymd = (offsetDays: number) => new Date(t + offsetDays * DAY).toISOString().slice(0, 10);
  const leave: LeaveRequest[] = [
    { id: "lv-001", employeeId: "emp-001", leaveType: "Annual", startDate: ymd(3), endDate: ymd(6), days: 4, reason: "Family visit", status: "Pending", decidedBy: "", decidedAt: null, createdAt: ago(1 * DAY) },
    { id: "lv-002", employeeId: "emp-007", leaveType: "Sick", startDate: ymd(1), endDate: ymd(1), days: 1, reason: "", status: "Pending", decidedBy: "", decidedAt: null, createdAt: ago(3 * HOUR) },
    { id: "lv-003", employeeId: "emp-011", leaveType: "Annual", startDate: ymd(-1), endDate: ymd(2), days: 4, reason: "Wedding", status: "Approved", decidedBy: "Tobi Ogun", decidedAt: ago(5 * DAY), createdAt: ago(9 * DAY) },
    { id: "lv-004", employeeId: "emp-009", leaveType: "Annual", startDate: ymd(0), endDate: ymd(4), days: 5, reason: "", status: "Approved", decidedBy: "Fatima Bello", decidedAt: ago(4 * DAY), createdAt: ago(8 * DAY) },
    { id: "lv-005", employeeId: "emp-002", leaveType: "Annual", startDate: ymd(-40), endDate: ymd(-31), days: 8, reason: "", status: "Approved", decidedBy: "Tobi Ogun", decidedAt: ago(50 * DAY), createdAt: ago(55 * DAY) },
    { id: "lv-006", employeeId: "emp-014", leaveType: "Study", startDate: ymd(-20), endDate: ymd(-18), days: 3, reason: "Exams", status: "Declined", decidedBy: "Ifeoma Obi", decidedAt: ago(25 * DAY), createdAt: ago(27 * DAY) },
  ];

  const goals: Goal[] = [
    { id: "goal-001", title: "Cut average time-to-hire to 21 days", ownerName: "Grace Nwosu", department: "People Operations", dueDate: ymd(18), progress: 72, createdAt: ago(60 * DAY) },
    { id: "goal-002", title: "Launch employer self-service onboarding", ownerName: "Tobi Ogun", department: "Engineering", dueDate: ymd(33), progress: 48, createdAt: ago(45 * DAY) },
    { id: "goal-003", title: "Grow qualified applications by 30%", ownerName: "Ifeoma Obi", department: "Marketing", dueDate: ymd(19), progress: 91, createdAt: ago(70 * DAY) },
    { id: "goal-004", title: "Close 25 new employer accounts in Q4", ownerName: "Fatima Bello", department: "Sales", dueDate: ymd(79), progress: 22, createdAt: ago(12 * DAY) },
    { id: "goal-005", title: "Monthly close done in 5 working days", ownerName: "Kunle Akande", department: "Finance", dueDate: ymd(48), progress: 60, createdAt: ago(30 * DAY) },
  ];

  const cycle = `Q${Math.floor(today.getUTCMonth() / 3) + 1} ${today.getUTCFullYear()}`;
  const reviewStatuses: Review["status"][] = ["Completed", "Completed", "Manager review", "Self review", "Not started", "Completed", "Manager review", "Completed", "Self review", "Not started", "Completed", "Completed", "Not started", "Manager review"];
  const reviews: Review[] = employees
    .filter((e) => e.status === "Active")
    .map((e, i) => ({
      id: `rev-${String(i + 1).padStart(3, "0")}`,
      employeeId: e.id,
      cycle,
      status: reviewStatuses[i % reviewStatuses.length],
      rating: reviewStatuses[i % reviewStatuses.length] === "Completed" ? [4, 3, 5, 4, 3][i % 5] : null,
      summary: "",
      reviewerName: reviewStatuses[i % reviewStatuses.length] === "Not started" ? "" : e.managerName || "Grace Nwosu",
      updatedAt: ago((i + 1) * DAY),
    }));

  const month = (back: number) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const payrollRuns: PayrollRun[] = [1, 2].map((back) => ({
    id: `pay-${back}`,
    period: month(back),
    status: "Approved",
    employeeCount: Object.keys(pay).length - (back === 2 ? 1 : 0),
    grossTotal: Object.values(pay).reduce((a, b) => a + b, 0) - (back === 2 ? 380000 : 0),
    preparedBy: "Grace Nwosu",
    approvedBy: "Kunle Akande",
    approvedAt: ago((back * 30 - 2) * DAY),
    createdAt: ago((back * 30) * DAY),
  }));

  const settings: CompanySettings = { companyName: "MyJobMag (demo)", leaveAllowanceDays: 20, workStart: "09:00" };

  const activity: Activity[] = [
    {
      id: "act-003",
      kind: "application",
      title: "New application received",
      detail: "Amaka Okafor · Product Designer",
      at: ago(2 * HOUR),
    },
    {
      id: "act-002",
      kind: "interview",
      title: "Interview scheduled",
      detail: "Tunde Mohammed · Frontend Engineer",
      at: ago(4 * HOUR),
    },
    {
      id: "act-001",
      kind: "offer",
      title: "Offer sent",
      detail: "Samuel Adeyemi · Sales Executive",
      at: ago(1 * DAY),
    },
  ];

  const inbox: SelfServiceRequest[] = [
    {
      id: "req-002",
      channel: "WhatsApp",
      from: "Peter James",
      role: "Employee",
      kind: "Leave request",
      detail: "Sick leave · 1 day from 14/10",
      status: "New",
      at: ago(3 * HOUR),
    },
    {
      id: "req-001",
      channel: "WhatsApp",
      from: "Halima Sani",
      role: "Candidate",
      kind: "Application status",
      detail: "Sales Executive · told: interview booked",
      status: "Answered automatically",
      at: ago(1 * DAY),
    },
  ];

  return {
    jobs,
    candidates,
    employees,
    activity,
    talentDb: talentDatabase(ago),
    invitations: [],
    inbox,
    pay,
    leave,
    goals,
    reviews,
    payrollRuns,
    settings,
    holidays: [{ id: "hol-001", date: `${today.getUTCFullYear()}-12-31`, name: "Company end-of-year day" }],
    onboarding: seedOnboarding(employees, ago),
    attendance: seedAttendance(employees, today, leave),
    careers: {
      enabled: true,
      slug: "myjobmag-demo",
      intro: "We help Nigerian employers find great people. Come build it with us: flexible hybrid work, real ownership, and a team that ships.",
    },
  };
}

/** Kemi Adeyemi is starting soon: the first few steps are done. */
function seedOnboarding(employees: Employee[], ago: (ms: number) => string): OnboardingTask[] {
  const kemi = employees.find((e) => e.status === "Onboarding");
  if (!kemi) return [];
  return onboardingTemplate(kemi.id, kemi.startDate, "onb-001").map((t, i) =>
    i < 2 ? { ...t, doneAt: ago((72 - i * 24) * 3_600_000), doneBy: "Grace Nwosu" } : t,
  );
}

/**
 * A week of synthetic clock-ins so the attendance board has something to show.
 * Deterministic (no randomness) so tests and screenshots are stable.
 */
function seedAttendance(employees: Employee[], today: Date, leave: LeaveRequest[]): AttendanceRecord[] {
  const out: AttendanceRecord[] = [];
  const staff = employees.filter((e) => e.status === "Active");
  const todayLagos = lagosDate(today.toISOString());
  const nowMinutes = Number(lagosTime(today.toISOString()).slice(0, 2)) * 60 + Number(lagosTime(today.toISOString()).slice(3));
  lastDays(todayLagos, 8).forEach((date, d) => {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) return;
    const isToday = date === todayLagos;
    staff.forEach((e, i) => {
      if (leave.some((l) => l.employeeId === e.id && l.status === "Approved" && l.startDate <= date && l.endDate >= date)) return;
      if ((i * 7 + d * 3) % 11 === 0) return; // the odd absence
      const inMin = 8 * 60 + 20 + ((i * 13 + d * 17) % 70); // 08:20–09:29
      if (isToday && inMin > nowMinutes) return;
      const outMin = 17 * 60 + ((i * 11 + d * 7) % 75); // 17:00–18:14
      const mode = e.location.includes("Remote") ? "Remote" : e.location.includes("Field") ? "Field" : (i + d) % 4 === 0 ? "Remote" : "Office";
      const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      out.push({
        id: `att-${date}-${e.id}`,
        employeeId: e.id,
        date,
        clockIn: lagosToIso(date, hm(inMin)),
        clockOut: isToday && outMin > nowMinutes ? null : lagosToIso(date, hm(outMin)),
        mode,
        correctedBy: "",
        correctedAt: null,
      });
    });
  });
  return out;
}
