// Shared (client + server) description of the current workspace.

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

export function canEditRecruitment(w: WorkspaceInfo): boolean {
  return w.mode === "demo" || RECRUITMENT_WRITERS.includes(w.me.role);
}
