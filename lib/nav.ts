import type { IconName } from "@/components/ui/Icon";
import { DASHBOARD_NAME, ROLE_PAGES } from "./roles";
import type { Role } from "./workspace";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Built in this increment? Others show a "coming next" placeholder. */
  ready: boolean;
}

export const WORKSPACE_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "overview", ready: true },
  { href: "/team", label: "My team", icon: "people", ready: true },
  { href: "/me", label: "My space", icon: "user", ready: true },
  { href: "/me/profile", label: "My profile", icon: "user", ready: true },
  { href: "/me/leave", label: "My leave", icon: "calendar", ready: true },
  { href: "/me/attendance", label: "My attendance", icon: "clock", ready: true },
  { href: "/me/payslips", label: "My payslips", icon: "naira", ready: true },
  { href: "/me/performance", label: "My performance", icon: "trend", ready: true },
  { href: "/employees", label: "Employees", icon: "people", ready: true },
  { href: "/recruitment", label: "Recruitment", icon: "search", ready: true },
  { href: "/whatsapp", label: "WhatsApp desk", icon: "chat", ready: true },
  { href: "/leave", label: "Leave & attendance", icon: "calendar", ready: true },
  { href: "/payroll", label: "Payroll & payslips", icon: "naira", ready: true },
  { href: "/performance", label: "Performance", icon: "trend", ready: true },
];

export const MANAGE_NAV: NavItem[] = [
  { href: "/reports", label: "Reports", icon: "report", ready: true },
  { href: "/settings", label: "Settings", icon: "settings", ready: true },
];

export function pageTitle(pathname: string, role?: Role): string {
  const all = [...WORKSPACE_NAV, ...MANAGE_NAV];
  const match = all.sort((a, b) => b.href.length - a.href.length).find((n) => (n.href === "/" ? pathname === "/" : pathname === n.href || pathname.startsWith(`${n.href}/`)));
  if (pathname === "/" && role) return DASHBOARD_NAME[role];
  return match?.label ?? "Overview";
}

/** The menu for one role: only the pages it can open, with its own name for the home page. */
export function navFor(role: Role, live: boolean): { workspace: NavItem[]; manage: NavItem[] } {
  const pages = ROLE_PAGES[role];
  const keep = (n: NavItem) => pages.includes(n.href) && !(role === "employee" && n.href === "/") && !(live && n.href === "/whatsapp");
  return {
    workspace: WORKSPACE_NAV.filter(keep).map((n) => (n.href === "/" ? { ...n, label: DASHBOARD_NAME[role] } : n)),
    manage: MANAGE_NAV.filter(keep),
  };
}
