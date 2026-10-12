import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Built in this increment? Others show a "coming next" placeholder. */
  ready: boolean;
}

export const WORKSPACE_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "overview", ready: true },
  { href: "/employees", label: "Employees", icon: "people", ready: false },
  { href: "/recruitment", label: "Recruitment", icon: "search", ready: true },
  { href: "/whatsapp", label: "WhatsApp desk", icon: "chat", ready: true },
  { href: "/leave", label: "Leave & attendance", icon: "calendar", ready: false },
  { href: "/payroll", label: "Payroll & payslips", icon: "naira", ready: false },
  { href: "/performance", label: "Performance", icon: "trend", ready: false },
];

export const MANAGE_NAV: NavItem[] = [
  { href: "/reports", label: "Reports", icon: "report", ready: false },
  { href: "/settings", label: "Settings", icon: "settings", ready: false },
];

export function pageTitle(pathname: string): string {
  const all = [...WORKSPACE_NAV, ...MANAGE_NAV];
  const match = all.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
  return match?.label ?? "Overview";
}
