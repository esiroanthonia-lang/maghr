// Shared (client + server) description of the current workspace.

import { DEMO_PERSONAS } from "./roles";

export const ROLES = ["hr_admin", "recruiter", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  hr_admin: "HR admin",
  recruiter: "Recruiter",
  manager: "Manager",
  employee: "Employee",
};

/** Roles allowed to change recruitment data (the database enforces the same rule). */
export const RECRUITMENT_WRITERS: Role[] = ["hr_admin", "recruiter"];

export type WorkspaceInfo =
  | { mode: "demo" }
  | {
      mode: "live";
      orgId: string;
      orgName: string;
      me: { userId: string; name: string; email: string; role: Role };
    };

export function canEditRecruitment(w: WorkspaceInfo, demoRole?: Role): boolean {
  if (w.mode === "demo") return demoRole ? RECRUITMENT_WRITERS.includes(demoRole) : true;
  return RECRUITMENT_WRITERS.includes(w.me.role);
}

/** Which roles may perform each kind of change. The database enforces the same rules. */
const ACTION_ROLES: [prefix: string, roles: Role[]][] = [
  ["inbox/", ["hr_admin"]],
  // Anyone can request or cancel their own leave; the server and database check it's their own.
  ["leave/request", ["hr_admin", "manager", "recruiter", "employee"]],
  ["leave/cancel", ["hr_admin", "manager", "recruiter", "employee"]],
  // New hires tick off their own steps; the server checks the step is theirs and marked "New hire".
  // Everyone clocks themselves in and out; the server checks it's their own record.
  ["attendance/clockIn", ["hr_admin", "manager", "recruiter", "employee"]],
  ["attendance/clockOut", ["hr_admin", "manager", "recruiter", "employee"]],
  ["attendance/", ["hr_admin"]],
  ["onboarding/toggle", ["hr_admin", "manager", "recruiter", "employee"]],
  ["onboarding/", ["hr_admin", "manager"]],
  // People update their own personal details; the server and database check it's their own.
  ["employee/updatePersonal", ["hr_admin", "manager", "recruiter", "employee"]],
  ["employee/", ["hr_admin"]],
  ["leave/", ["hr_admin", "manager"]],
  ["goal/", ["hr_admin", "manager"]],
  ["review/", ["hr_admin", "manager"]],
  ["payroll/", ["hr_admin"]],
  ["settings/", ["hr_admin"]],
  ["", RECRUITMENT_WRITERS], // everything else is recruitment
];

export function rolesFor(actionType: string): Role[] {
  return ACTION_ROLES.find(([prefix]) => actionType.startsWith(prefix))![1];
}

export function canPerform(w: WorkspaceInfo, actionType: string, demoRole?: Role): boolean {
  if (w.mode === "demo") return demoRole ? rolesFor(actionType).includes(demoRole) : true;
  return rolesFor(actionType).includes(w.me.role);
}

/** The employee record that belongs to the signed-in person (matched by work email). */
export function myEmployeeEmail(w: WorkspaceInfo, demoRole: Role = "hr_admin"): string | null {
  return w.mode === "live" ? w.me.email.toLowerCase() : DEMO_PERSONAS[demoRole]; // demo persona
}
