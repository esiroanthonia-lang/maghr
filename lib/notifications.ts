// What needs the signed-in person's attention, worked out from the workspace state.
// Pure and role-aware: each person only sees items about things they can act on or that are theirs.

import type { IconName } from "@/components/ui/Icon";
import type { DemoState } from "./demo-data";
import { periodLabel } from "./people";
import { upcomingInterviews } from "./recruitment";
import { myEmployeeEmail, type Role, type WorkspaceInfo } from "./workspace";

export interface Notification {
  /** Stable while the underlying thing is unchanged, so "seen" can be remembered. */
  id: string;
  title: string;
  detail: string;
  href: string;
  icon: IconName;
  tone: "orange" | "blue" | "green" | "purple";
}

const DAY = 86_400_000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function notificationsFor(state: DemoState, workspace: WorkspaceInfo, now: Date): Notification[] {
  const role: Role = workspace.mode === "demo" ? "hr_admin" : workspace.me.role;
  const myName = workspace.mode === "live" ? workspace.me.name : "HR Admin";
  const today = now.toISOString().slice(0, 10);
  const out: Notification[] = [];
  const staff = role === "hr_admin" || role === "manager";
  const hiring = role === "hr_admin" || role === "recruiter";

  if (staff) {
    const pending = state.leave.filter((l) => l.status === "Pending");
    if (pending.length) {
      const names = pending.map((l) => state.employees.find((e) => e.id === l.employeeId)?.name ?? "Someone");
      out.push({
        id: `leave:${pending.map((l) => l.id).sort().join(",")}`,
        title: `${plural(pending.length, "leave request")} to decide`,
        detail: names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : ""),
        href: "/leave",
        icon: "calendar",
        tone: "orange",
      });
    }
  }

  if (role === "hr_admin") {
    for (const r of state.payrollRuns.filter((r) => r.status === "Pending approval")) {
      const mine = workspace.mode === "live" && r.preparedBy === myName;
      out.push({
        id: `payroll:${r.id}:${mine ? "mine" : "approve"}`,
        title: mine ? `${periodLabel(r.period)} payroll is waiting for a second admin` : `Approve ${periodLabel(r.period)} payroll`,
        detail: mine ? "Another HR admin needs to approve it" : `Prepared by ${r.preparedBy || "an HR admin"}`,
        href: "/payroll",
        icon: "naira",
        tone: "green",
      });
    }
    const open = state.inbox.filter((r) => r.status === "New");
    if (open.length) {
      out.push({
        id: `inbox:${open.map((r) => r.id).sort().join(",")}`,
        title: `${plural(open.length, "WhatsApp request")} waiting`,
        detail: open.slice(0, 2).map((r) => `${r.from}: ${r.kind}`).join(" · "),
        href: "/whatsapp",
        icon: "chat",
        tone: "green",
      });
    }
  }

  if (hiring) {
    const fresh = state.candidates.filter((c) => c.stage === "Applied" && c.jobId && now.getTime() - Date.parse(c.createdAt) < 7 * DAY);
    if (fresh.length) {
      out.push({
        id: `applied:${fresh.map((c) => c.id).sort().join(",")}`,
        title: `${plural(fresh.length, "new application")} this week`,
        detail: fresh.slice(0, 3).map((c) => c.name).join(", ") + (fresh.length > 3 ? ` and ${fresh.length - 3} more` : ""),
        href: "/recruitment?tab=pipeline",
        icon: "userPlus",
        tone: "blue",
      });
    }
  }

  if (staff || hiring) {
    const soon = upcomingInterviews(state, now).filter((r) => Date.parse(r.interview.scheduledFor) - now.getTime() < 2 * DAY);
    for (const r of soon) {
      const at = new Date(r.interview.scheduledFor);
      const when = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(at);
      out.push({
        id: `interview:${r.interview.id}:${r.interview.scheduledFor}`,
        title: `Interview with ${r.candidate.name}`,
        detail: `${when}${r.job ? ` · ${r.job.title}` : ""}`,
        href: "/recruitment?tab=interviews",
        icon: "clock",
        tone: "purple",
      });
    }
  }

  if (staff) {
    const live = new Map(state.employees.filter((e) => e.status !== "Exited").map((e) => [e.id, e]));
    const overdue = state.onboarding.filter((t) => !t.doneAt && t.dueDate && t.dueDate < today && t.owner !== "New hire" && live.has(t.employeeId));
    const byPerson = new Map<string, number>();
    for (const t of overdue) byPerson.set(t.employeeId, (byPerson.get(t.employeeId) ?? 0) + 1);
    for (const [employeeId, n] of byPerson) {
      out.push({
        id: `onboarding:${employeeId}:${overdue.filter((t) => t.employeeId === employeeId).map((t) => t.id).sort().join(",")}`,
        title: `${plural(n, "onboarding step")} overdue`,
        detail: `For ${live.get(employeeId)!.name}`,
        href: "/employees",
        icon: "check",
        tone: "orange",
      });
    }
  }

  // Things about the signed-in person themselves.
  const email = myEmployeeEmail(workspace);
  const me = workspace.mode === "live" ? state.employees.find((e) => e.email.toLowerCase() === email) : undefined;
  if (me) {
    for (const l of state.leave.filter((l) => l.employeeId === me.id && (l.status === "Approved" || l.status === "Declined") && l.decidedAt && now.getTime() - Date.parse(l.decidedAt) < 14 * DAY)) {
      out.push({
        id: `myleave:${l.id}:${l.status}`,
        title: `Your ${l.leaveType.toLowerCase()} leave was ${l.status.toLowerCase()}`,
        detail: `${l.startDate} to ${l.endDate}${l.decidedBy ? ` · by ${l.decidedBy}` : ""}`,
        href: "/me",
        icon: "calendar",
        tone: l.status === "Approved" ? "green" : "orange",
      });
    }
    const mySteps = state.onboarding.filter((t) => t.employeeId === me.id && t.owner === "New hire" && !t.doneAt);
    if (mySteps.length) {
      out.push({
        id: `mysteps:${mySteps.map((t) => t.id).sort().join(",")}`,
        title: `${plural(mySteps.length, "onboarding step")} for you`,
        detail: mySteps[0].title,
        href: "/me",
        icon: "check",
        tone: "blue",
      });
    }
  }

  return out;
}
