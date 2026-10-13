// What each role sees: which pages are in its menu, and which person the demo pretends to be.
// This only shapes the screens. The server and database still decide what anyone may read or change.

import type { Role } from "./workspace";

/** Demo workspace personas, so each role can be tried without signing in. All synthetic. */
export const DEMO_PERSONAS: Record<Role, string> = {
  hr_admin: "grace.nwosu@example.com",
  recruiter: "sade.williams@example.com",
  manager: "tobi.ogun@example.com",
  employee: "daniel.adebayo@example.com",
};

/** Pages each role can open. The first entry is its home. */
export const ROLE_PAGES: Record<Role, string[]> = {
  hr_admin: ["/", "/me", "/employees", "/recruitment", "/whatsapp", "/leave", "/payroll", "/performance", "/reports", "/settings"],
  recruiter: ["/", "/me", "/recruitment", "/whatsapp", "/settings"],
  manager: ["/", "/team", "/me", "/leave", "/performance", "/settings"],
  employee: ["/", "/me", "/me/profile", "/me/leave", "/me/attendance", "/me/payslips", "/me/performance", "/settings"],
};

export function canOpen(role: Role, pathname: string): boolean {
  return ROLE_PAGES[role].some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
}

/** Employee profiles open from the Employees page, which only HR admins have. */
export const roleHome = (_role: Role): string => "/";

export const DASHBOARD_NAME: Record<Role, string> = {
  hr_admin: "People overview",
  recruiter: "Hiring desk",
  manager: "Team overview",
  employee: "My space",
};
