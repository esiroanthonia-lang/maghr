// Synthetic, clearly fake personal records for the demo workspace. Never real people.
// Account numbers, RSA PINs and TINs are made-up patterns, not real identifiers.

import { emptyRecord, type BankDetails, type EmployeeRecord } from "./employee-record";
import type { Employee } from "./types";

const FEMALE = new Set(["Grace", "Chiamaka", "Fatima", "Ifeoma", "Blessing", "Sade", "Kemi", "Ruth", "Yetunde"]);
const ORIGIN = ["Lagos", "Anambra", "Kano", "Enugu", "Oyo", "Rivers", "Imo", "Kaduna", "Delta", "Ogun", "Kwara", "Edo", "Akwa Ibom", "Osun", "Abia", "Plateau"];
const STREETS: Record<string, string[]> = {
  Lagos: ["Admiralty Way, Lekki", "Allen Avenue, Ikeja", "Herbert Macaulay Way, Yaba", "Adeola Odeku Street, Victoria Island", "Awolowo Road, Ikoyi"],
  "FCT (Abuja)": ["Aminu Kano Crescent, Wuse 2", "Gimbiya Street, Garki"],
  Kano: ["Zoo Road", "Murtala Mohammed Way"],
  Rivers: ["Aba Road", "Olu Obasanjo Road"],
  Enugu: ["Ogui Road", "Independence Layout"],
};
const SCHOOLS = ["University of Lagos", "Obafemi Awolowo University", "University of Nigeria, Nsukka", "Ahmadu Bello University", "University of Ibadan", "Covenant University", "Lagos State University", "Federal University of Technology, Akure"];
const COURSES: Record<string, string> = {
  Engineering: "Computer Science",
  "People Operations": "Industrial Relations & Personnel Management",
  Sales: "Marketing",
  "Product & Design": "Architecture",
  Marketing: "Mass Communication",
  Finance: "Accounting",
};
const BANKS = ["Guaranty Trust Bank (GTBank)", "Access Bank", "Zenith Bank", "First Bank of Nigeria", "United Bank for Africa (UBA)", "Stanbic IBTC Bank", "Wema Bank", "Fidelity Bank"];
const PFAS = ["Stanbic IBTC Pension Managers", "Access ARM Pensions", "Leadway Pensure PFA", "Premium Pension", "Fidelity Pension Managers"];
const NOK_REL = ["Spouse", "Sister", "Brother", "Mother", "Father"];

const pad = (n: number, w: number) => String(n).padStart(w, "0");

export function seedRecords(employees: Employee[]): { records: Record<string, EmployeeRecord>; bank: Record<string, BankDetails> } {
  const records: Record<string, EmployeeRecord> = {};
  const bank: Record<string, BankDetails> = {};
  employees.forEach((e, i) => {
    const [first, last] = e.name.split(" ");
    const female = FEMALE.has(first);
    const startYear = Number(e.startDate.slice(0, 4));
    const birthYear = startYear - 24 - ((i * 7) % 14);
    const city = e.location.split(" ")[0] || "Lagos";
    const state = city === "Abuja" ? "FCT (Abuja)" : city === "Kano" ? "Kano" : city === "Port" ? "Rivers" : city === "Enugu" ? "Enugu" : "Lagos";
    const streets = STREETS[state];
    const street = streets[i % streets.length];
    const town = state === "FCT (Abuja)" ? "Abuja" : state === "Rivers" ? "Port Harcourt" : state === "Lagos" ? "Lagos" : state;
    const r = emptyRecord();
    r.personal = {
      ...r.personal,
      preferredName: i % 5 === 0 ? first.slice(0, 4) : "",
      dateOfBirth: `${birthYear}-${pad(((i * 5) % 12) + 1, 2)}-${pad(((i * 11) % 27) + 1, 2)}`,
      gender: female ? "Female" : "Male",
      maritalStatus: i % 3 === 0 ? "Single" : "Married",
      nationality: "Nigerian",
      stateOfOrigin: ORIGIN[i % ORIGIN.length],
      lga: "",
      personalEmail: `${first.toLowerCase()}.${(last ?? "x").toLowerCase()}.personal@example.com`,
      altPhone: `+234 70${i % 10} 555 ${pad(1000 + i * 37, 4)}`,
      address: `${10 + i * 3} ${street}`,
      city: town,
      stateOfResidence: state,
      nextOfKin: { name: `${female ? "Chinedu" : "Adaeze"} ${last ?? ""}`.trim(), relationship: NOK_REL[i % NOK_REL.length], phone: `+234 80${(i + 3) % 10} 555 ${pad(2000 + i * 41, 4)}`, address: `${10 + i * 3} ${street}, ${town}` },
      emergencyContacts: [{ name: `${["Tunde", "Ngozi", "Musa", "Bisi", "Emeka"][i % 5]} ${last ?? ""}`.trim(), relationship: ["Brother", "Sister", "Friend", "Cousin", "Uncle"][i % 5], phone: `+234 81${i % 10} 555 ${pad(3000 + i * 29, 4)}`, address: "" }],
      education: [
        {
          institution: SCHOOLS[i % SCHOOLS.length],
          qualification: e.department === "Engineering" ? "B.Sc." : e.department === "Finance" ? "B.Sc." : i % 2 ? "B.A." : "B.Sc.",
          course: COURSES[e.department] ?? "Business Administration",
          grade: ["Second class upper", "Second class lower", "First class", "Second class upper"][i % 4],
          year: String(birthYear + 22),
        },
      ],
      nyscStatus: "Completed",
      nyscYear: String(birthYear + 23),
    };
    r.job = {
      staffId: `MJM-${pad(i + 1, 4)}`,
      grade: /Head/.test(e.jobTitle) ? "Head of department" : /Manager/.test(e.jobTitle) ? "Manager" : /Lead/.test(e.jobTitle) ? "Lead" : i % 2 ? "Senior Associate" : "Associate",
      probationEnd: addMonths(e.startDate, 6),
      confirmedOn: e.status === "Onboarding" ? "" : addMonths(e.startDate, 6),
      contractEnd: e.employmentType === "Contract" ? addMonths(e.startDate, 24) : "",
      guarantors: e.status === "Onboarding" ? [] : [{ name: `${["Olu", "Chika", "Bello", "Efe"][i % 4]} ${["Adewale", "Okoro", "Ibrahim", "Edet"][i % 4]}`, phone: `+234 80${(i + 5) % 10} 555 ${pad(4000 + i * 13, 4)}`, occupation: ["Civil servant", "Lecturer", "Business owner", "Banker"][i % 4], address: `${5 + i} ${STREETS.Lagos[(i + 2) % STREETS.Lagos.length]}, Lagos`, verified: i % 3 !== 1 }],
    };
    if (e.status === "Onboarding") {
      // A new starter with gaps, so the completeness meter has something to show.
      r.personal = { ...r.personal, address: "", nextOfKin: { name: "", relationship: "", phone: "", address: "" }, education: [], nyscStatus: "", nyscYear: "" };
    }
    records[e.id] = r;
    if (e.status !== "Onboarding") {
      bank[e.id] = {
        bankName: BANKS[i % BANKS.length],
        accountNumber: `01${pad(23456700 + i * 1117, 8)}`.slice(0, 10),
        accountName: e.name.toUpperCase(),
        pfa: PFAS[i % PFAS.length],
        rsaPin: `PEN1000${pad(55500 + i * 3, 8)}`.slice(0, 15),
        tin: `${pad(20000000 + i * 4321, 8)}-0001`,
        nhfNumber: i % 2 ? `NHF${pad(700000 + i, 7)}` : "",
        hmo: ["Hygeia HMO", "AXA Mansard Health", "Reliance HMO", "Leadway Health"][i % 4],
      };
    }
  });
  return { records, bank };
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}
