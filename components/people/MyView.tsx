"use client";

import Link from "next/link";
import { formatDate, pluralise } from "@/lib/format";
import { lagosDate, lagosTime } from "@/lib/attendance";
import { leaveBalance } from "@/lib/people";
import { myEmployeeEmail } from "@/lib/workspace";
import { Badge, EmptyState, PageHeader, Panel, StatCard } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { OnboardingChecklist } from "./Onboarding";
import { usePeople } from "./usePeople";

const d = (iso: string) => formatDate(`${iso}T12:00:00Z`);

const shortcuts = [
  ["/me/profile", "My profile", "Personal and work details", "user"],
  ["/me/leave", "Leave", "Balance and time off requests", "calendar"],
  ["/me/attendance", "Attendance", "Clock in and timesheet", "clock"],
  ["/me/payslips", "Payslips", "Approved pay statements", "naira"],
  ["/me/performance", "Performance", "Reviews and goals", "trend"],
] as const;

export function MyView() {
  const { state, workspace, role, year, now } = usePeople();
  const email = myEmployeeEmail(workspace, role);
  const me = state.employees.find((e) => e.email.toLowerCase() === email);
  const firstName = workspace.mode === "live" ? workspace.me.name.split(" ")[0] : me?.name.split(" ")[0];
  if (!me) return <>
    <PageHeader eyebrow="Employee dashboard" title={`Hello${firstName ? `, ${firstName}` : ""}`} intro="Your HR self-service home." />
    <Panel title="Your employee record isn’t linked yet"><EmptyState title="Ask HR to add you to the directory">Your account ({email}) will connect automatically once HR adds an employee record with the same email.</EmptyState></Panel>
  </>;

  const today = now ? lagosDate(now.toISOString()) : null;
  const balance = year ? leaveBalance(state, me.id, year) : null;
  const pending = state.leave.filter((l) => l.employeeId === me.id && l.status === "Pending");
  const upcoming = state.leave.find((l) => l.employeeId === me.id && l.status === "Approved" && (!today || l.endDate >= today));
  const attendance = today ? state.attendance.find((r) => r.employeeId === me.id && r.date === today) : undefined;
  const years = now ? Math.max(0, Math.floor((now.getTime() - Date.parse(`${me.startDate}T00:00:00Z`)) / (365.25 * 86400000))) : null;
  const tasks = state.onboarding.some((t) => t.employeeId === me.id && !t.doneAt);

  return <>
    <PageHeader
      eyebrow={workspace.mode === "live" ? workspace.orgName : "Employee dashboard"}
      title={`Good day, ${me.name.split(" ")[0]}`}
      intro={`${me.jobTitle} · ${me.department}${me.managerName ? ` · reporting to ${me.managerName}` : ""}`}
      actions={<Link className="btn primary" href="/me/profile"><Icon name="user" size={15} /> View my profile</Link>}
    />
    <div className="stats employee-stats">
      <StatCard label="Annual leave left" value={balance?.remaining ?? "—"} foot={balance ? `of ${balance.allowance} days this year` : "Balance unavailable"} icon="calendar" tone="green" />
      <StatCard label="Pending requests" value={pending.length} foot={pending.length ? "Waiting for approval" : "You’re all caught up"} icon="clock" tone="orange" />
      <StatCard label="Today" value={attendance ? lagosTime(attendance.clockIn) : "Not clocked in"} foot={attendance?.clockOut ? `Finished at ${lagosTime(attendance.clockOut)}` : attendance ? `${attendance.mode} · clock out when done` : "Open attendance to clock in"} icon="check" tone="blue" />
    </div>

    <section className="employee-shortcuts" aria-label="Self-service pages">
      {shortcuts.map(([href, label, detail, icon]) => <Link href={href} key={href} className="employee-shortcut">
        <span className="employee-shortcut-icon"><Icon name={icon} size={17} /></span>
        <span><strong>{label}</strong><small>{detail}</small></span>
        <span className="employee-shortcut-arrow" aria-hidden="true">↗</span>
      </Link>)}
    </section>

    <div className="report-grid employee-home-grid">
      <Panel title="Coming up" subtitle="Your next important dates">
        {upcoming ? <div className="employee-highlight"><span className="employee-highlight-icon"><Icon name="calendar" /></span><div><strong>{upcoming.leaveType} leave</strong><span>{d(upcoming.startDate)}{upcoming.endDate !== upcoming.startDate ? ` – ${d(upcoming.endDate)}` : ""}</span></div><Badge tone="ok">Approved</Badge></div> : <EmptyState title="Nothing scheduled">Approved leave will appear here.</EmptyState>}
        <div className="employee-home-foot">{years === null ? "" : years < 1 ? "You joined less than a year ago." : `${pluralise(years, "year")} with the team.`}</div>
      </Panel>
      <Panel title="Your first weeks" subtitle="Onboarding steps assigned to you">
        {tasks ? <div className="panel-body"><OnboardingChecklist employee={me} mode="self" /></div> : <EmptyState title="No onboarding tasks">When HR assigns you a checklist, you can complete your steps here.</EmptyState>}
      </Panel>
    </div>
  </>;
}
