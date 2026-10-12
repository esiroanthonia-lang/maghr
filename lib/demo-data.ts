// SYNTHETIC DEMO DATA ONLY.
// Every name, email and phone number below is invented for the prototype.
// Do not replace these with real candidate or employee records.

import type {
  Activity,
  Candidate,
  CandidateSource,
  CvProfile,
  Employee,
  Invitation,
  Job,
  SelfServiceRequest,
  Stage,
  TalentProfile,
} from "./types";

/** Headcount that the demo assumes exists outside the small sample directory. */
export const DEMO_BASE_HEADCOUNT = 124;

export interface DemoState {
  jobs: Job[];
  candidates: Candidate[];
  employees: Employee[];
  activity: Activity[];
  talentDb: TalentProfile[];
  invitations: Invitation[];
  inbox: SelfServiceRequest[];
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

  const employees: Employee[] = [
    {
      id: "emp-001",
      name: "Grace Nwosu",
      email: "grace.nwosu@example.com",
      department: "People Operations",
      jobTitle: "HR Manager",
      location: "Lagos · Hybrid",
      startDate: "2022-03-01",
      status: "Active",
      source: "Seed",
    },
    {
      id: "emp-002",
      name: "Daniel Adebayo",
      email: "daniel.adebayo@example.com",
      department: "Engineering",
      jobTitle: "Software Engineer",
      location: "Remote",
      startDate: "2023-01-16",
      status: "Active",
      source: "Seed",
    },
    {
      id: "emp-003",
      name: "Fatima Bello",
      email: "fatima.bello@example.com",
      department: "Sales",
      jobTitle: "Sales Lead",
      location: "Abuja · On-site",
      startDate: "2021-07-05",
      status: "Active",
      source: "Seed",
    },
    {
      id: "emp-004",
      name: "Michael Ekanem",
      email: "michael.ekanem@example.com",
      department: "Product & Design",
      jobTitle: "Product Designer",
      location: "Lagos · Hybrid",
      startDate: "2024-02-12",
      status: "Active",
      source: "Seed",
    },
  ];

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

  return { jobs, candidates, employees, activity, talentDb: talentDatabase(ago), invitations: [], inbox };
}
