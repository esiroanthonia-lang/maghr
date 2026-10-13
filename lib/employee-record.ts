// The full employee record: personal details, next of kin, guarantors, education, NYSC,
// job and contract details, and bank / statutory numbers. Pure types, defaults and validation.
//
// Who sees what (enforced again by the database, see 20261013000008_employee_records.sql):
//   - personal + job record: HR admins, and the person themselves. The person may edit their own
//     personal section (address, contacts, next of kin…) but not the job section.
//   - bank & statutory numbers: HR admins edit; the person can read their own. Shown masked.
//   - managers and recruiters see only the directory basics.

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

/** Suggestions only; people can type any bank. */
export const BANK_SUGGESTIONS = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank", "First Bank of Nigeria", "First City Monument Bank (FCMB)",
  "Globus Bank", "Guaranty Trust Bank (GTBank)", "Jaiz Bank", "Keystone Bank", "Kuda Bank", "Lotus Bank", "Moniepoint MFB", "OPay",
  "Optimus Bank", "PalmPay", "Parallex Bank", "Polaris Bank", "PremiumTrust Bank", "Providus Bank", "Signature Bank", "Stanbic IBTC Bank",
  "Standard Chartered Bank", "Sterling Bank", "SunTrust Bank", "TAJBank", "Titan Trust Bank", "Union Bank of Nigeria",
  "United Bank for Africa (UBA)", "Unity Bank", "Wema Bank", "Zenith Bank",
];

/** Suggestions only; check the person's statement from their Pension Fund Administrator. */
export const PFA_SUGGESTIONS = [
  "Access ARM Pensions", "CardinalStone Pensions", "FCMB Pensions", "Fidelity Pension Managers", "Guaranty Trust Pension Managers",
  "Leadway Pensure PFA", "NLPC Pension Fund Administrators", "Norrenberger Pensions", "NPF Pensions", "Oak Pensions",
  "Pensions Alliance Limited (PAL)", "Premium Pension", "Stanbic IBTC Pension Managers", "Tangerine APT Pensions",
  "Trustfund Pensions", "Veritas Glanvills Pensions",
];

export const GENDERS = ["Female", "Male", "Prefer not to say"] as const;
export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"] as const;
export const NYSC_STATUSES = ["Completed", "Exempted", "Serving", "Not applicable"] as const;
export const QUALIFICATIONS = ["SSCE / WAEC", "OND", "HND", "B.Sc.", "B.A.", "B.Eng.", "B.Tech.", "LL.B.", "MBBS", "M.Sc.", "MBA", "M.A.", "Ph.D.", "Professional certificate", "Other"] as const;
export const DEGREE_CLASSES = ["First class", "Second class upper", "Second class lower", "Third class", "Pass", "Distinction", "Upper credit", "Lower credit", "Not applicable"] as const;

export interface Contact {
  name: string;
  relationship: string;
  phone: string;
  address: string;
}

export interface Education {
  institution: string;
  qualification: string;
  course: string;
  grade: string;
  year: string;
}

export interface Guarantor {
  name: string;
  phone: string;
  occupation: string;
  address: string;
  verified: boolean;
}

export interface PersonalDetails {
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  nationality: string;
  stateOfOrigin: string;
  lga: string;
  personalEmail: string;
  altPhone: string;
  address: string;
  city: string;
  stateOfResidence: string;
  nextOfKin: Contact;
  emergencyContacts: Contact[];
  education: Education[];
  nyscStatus: string;
  nyscYear: string;
}

export interface JobDetails {
  staffId: string;
  grade: string;
  probationEnd: string;
  confirmedOn: string;
  contractEnd: string;
  guarantors: Guarantor[];
}

export interface EmployeeRecord {
  personal: PersonalDetails;
  job: JobDetails;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  pfa: string;
  rsaPin: string;
  tin: string;
  nhfNumber: string;
  hmo: string;
}

export const emptyContact = (): Contact => ({ name: "", relationship: "", phone: "", address: "" });

export const EMPTY_PERSONAL: PersonalDetails = {
  preferredName: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  nationality: "Nigerian",
  stateOfOrigin: "",
  lga: "",
  personalEmail: "",
  altPhone: "",
  address: "",
  city: "",
  stateOfResidence: "",
  nextOfKin: emptyContact(),
  emergencyContacts: [],
  education: [],
  nyscStatus: "",
  nyscYear: "",
};

export const EMPTY_JOB: JobDetails = { staffId: "", grade: "", probationEnd: "", confirmedOn: "", contractEnd: "", guarantors: [] };

export const EMPTY_BANK: BankDetails = { bankName: "", accountNumber: "", accountName: "", pfa: "", rsaPin: "", tin: "", nhfNumber: "", hmo: "" };

// ---------- normalising stored JSON ----------

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = <T>(v: unknown, f: (x: unknown) => T, max: number): T[] => (Array.isArray(v) ? v.slice(0, max).map(f) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const toContact = (v: unknown): Contact => {
  const o = obj(v);
  return { name: str(o.name, 120), relationship: str(o.relationship, 60), phone: str(o.phone, 30), address: str(o.address, 300) };
};
const toEducation = (v: unknown): Education => {
  const o = obj(v);
  return { institution: str(o.institution, 160), qualification: str(o.qualification, 60), course: str(o.course, 120), grade: str(o.grade, 60), year: str(o.year, 4) };
};
const toGuarantor = (v: unknown): Guarantor => {
  const o = obj(v);
  return { name: str(o.name, 120), phone: str(o.phone, 30), occupation: str(o.occupation, 120), address: str(o.address, 300), verified: o.verified === true };
};

export function normalisePersonal(v: unknown): PersonalDetails {
  const o = obj(v);
  return {
    preferredName: str(o.preferredName, 60),
    dateOfBirth: str(o.dateOfBirth, 10),
    gender: str(o.gender, 30),
    maritalStatus: str(o.maritalStatus, 30),
    nationality: str(o.nationality, 60) || "Nigerian",
    stateOfOrigin: str(o.stateOfOrigin, 40),
    lga: str(o.lga, 80),
    personalEmail: str(o.personalEmail, 200),
    altPhone: str(o.altPhone, 30),
    address: str(o.address, 300),
    city: str(o.city, 80),
    stateOfResidence: str(o.stateOfResidence, 40),
    nextOfKin: toContact(o.nextOfKin),
    emergencyContacts: arr(o.emergencyContacts, toContact, 3),
    education: arr(o.education, toEducation, 6),
    nyscStatus: str(o.nyscStatus, 30),
    nyscYear: str(o.nyscYear, 4),
  };
}

export function normaliseJob(v: unknown): JobDetails {
  const o = obj(v);
  return {
    staffId: str(o.staffId, 30),
    grade: str(o.grade, 40),
    probationEnd: str(o.probationEnd, 10),
    confirmedOn: str(o.confirmedOn, 10),
    contractEnd: str(o.contractEnd, 10),
    guarantors: arr(o.guarantors, toGuarantor, 3),
  };
}

export function normaliseBank(v: unknown): BankDetails {
  const o = obj(v);
  return {
    bankName: str(o.bankName, 80),
    accountNumber: str(o.accountNumber, 10),
    accountName: str(o.accountName, 120),
    pfa: str(o.pfa, 80),
    rsaPin: str(o.rsaPin, 15).toUpperCase(),
    tin: str(o.tin, 20),
    nhfNumber: str(o.nhfNumber, 30),
    hmo: str(o.hmo, 80),
  };
}

// ---------- validation (returns field → message) ----------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkPersonal(p: PersonalDetails, today?: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (p.dateOfBirth) {
    if (!DATE.test(p.dateOfBirth)) e.dateOfBirth = "Use a real date.";
    else if (today && p.dateOfBirth > today) e.dateOfBirth = "Date of birth can’t be in the future.";
    else if (today && Number(today.slice(0, 4)) - Number(p.dateOfBirth.slice(0, 4)) < 15) e.dateOfBirth = "That makes them younger than 15. Check the year.";
  }
  if (p.personalEmail && !EMAIL.test(p.personalEmail)) e.personalEmail = "Enter a valid email.";
  if (p.altPhone && !PHONE.test(p.altPhone)) e.altPhone = "Enter a phone number, e.g. +234 803 000 0000.";
  if (p.nextOfKin.phone && !PHONE.test(p.nextOfKin.phone)) e.nextOfKin = "Next of kin phone doesn’t look right.";
  p.emergencyContacts.forEach((c, i) => {
    if (c.phone && !PHONE.test(c.phone)) e[`emergency${i}`] = "Emergency contact phone doesn’t look right.";
    if (!c.name && c.phone) e[`emergency${i}`] = "Add the emergency contact’s name.";
  });
  if (p.nyscYear && !/^(19|20)\d{2}$/.test(p.nyscYear)) e.nyscYear = "Use a 4-digit year.";
  p.education.forEach((x, i) => {
    if (x.year && !/^(19|20)\d{2}$/.test(x.year)) e[`education${i}`] = "Use a 4-digit year.";
    if (!x.institution && (x.course || x.qualification)) e[`education${i}`] = "Add the school or institution.";
  });
  return e;
}

export function checkJob(j: JobDetails): Record<string, string> {
  const e: Record<string, string> = {};
  for (const k of ["probationEnd", "confirmedOn", "contractEnd"] as const) if (j[k] && !DATE.test(j[k])) e[k] = "Use a real date.";
  j.guarantors.forEach((g, i) => {
    if (g.phone && !PHONE.test(g.phone)) e[`guarantor${i}`] = "Guarantor phone doesn’t look right.";
    if (!g.name && (g.phone || g.address)) e[`guarantor${i}`] = "Add the guarantor’s name.";
  });
  return e;
}

export function checkBank(b: BankDetails): Record<string, string> {
  const e: Record<string, string> = {};
  if (b.accountNumber && !/^\d{10}$/.test(b.accountNumber)) e.accountNumber = "Nigerian account numbers (NUBAN) are 10 digits.";
  if (b.accountNumber && !b.bankName) e.bankName = "Add the bank.";
  if (b.rsaPin && !/^PEN\d{12}$/.test(b.rsaPin)) e.rsaPin = "RSA PINs look like PEN followed by 12 digits.";
  if (b.tin && !/^[0-9-]{8,20}$/.test(b.tin)) e.tin = "Tax IDs are digits (and dashes), 8–20 characters.";
  return e;
}

/** "0123456789" → "••••••6789" */
export function mask(v: string, keep = 4): string {
  if (!v) return "";
  return v.length <= keep ? v : "•".repeat(Math.min(6, v.length - keep)) + v.slice(-keep);
}

/** What's still missing from a record, in plain words, for the completeness meter. */
export function missingItems(r: EmployeeRecord, b: BankDetails | null, opts: { includeBank: boolean }): string[] {
  const m: string[] = [];
  const p = r.personal;
  if (!p.dateOfBirth) m.push("Date of birth");
  if (!p.address) m.push("Home address");
  if (!p.stateOfOrigin) m.push("State of origin");
  if (!p.nextOfKin.name || !p.nextOfKin.phone) m.push("Next of kin");
  if (!p.emergencyContacts.some((c) => c.name && c.phone)) m.push("Emergency contact");
  if (!p.education.some((x) => x.institution)) m.push("Education");
  if (!r.job.staffId) m.push("Staff ID");
  if (!r.job.guarantors.some((g) => g.name)) m.push("Guarantor");
  if (opts.includeBank) {
    if (!b?.accountNumber) m.push("Bank account");
    if (!b?.rsaPin) m.push("Pension RSA PIN");
    if (!b?.tin) m.push("Tax ID (TIN)");
  }
  return m;
}

export function completeness(r: EmployeeRecord, b: BankDetails | null, opts: { includeBank: boolean }): number {
  const total = opts.includeBank ? 11 : 8;
  return Math.round(((total - missingItems(r, b, opts).length) / total) * 100);
}

export function emptyRecord(): EmployeeRecord {
  return { personal: { ...EMPTY_PERSONAL, nextOfKin: emptyContact(), emergencyContacts: [], education: [] }, job: { ...EMPTY_JOB, guarantors: [] } };
}

/** Age in whole years on a given date. */
export function ageOn(dateOfBirth: string, today: string): number | null {
  if (!DATE.test(dateOfBirth) || !DATE.test(today)) return null;
  let age = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  if (today.slice(5) < dateOfBirth.slice(5)) age--;
  return age >= 0 ? age : null;
}
