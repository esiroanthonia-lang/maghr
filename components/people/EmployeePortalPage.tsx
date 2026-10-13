"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { formatDate, pluralise } from "@/lib/format";
import { lagosDate, lagosTime } from "@/lib/attendance";
import { formatNaira, holidaysForState, leaveBalance, periodLabel, workingDays } from "@/lib/people";
import { myEmployeeEmail } from "@/lib/workspace";
import { LEAVE_TYPES, type LeaveType } from "@/lib/types";
import { Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/bits";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { usePeople } from "./usePeople";
import { ClockCard } from "./Attendance";
import { EmployeeProfile } from "./EmployeeProfile";

type Section = "profile" | "leave" | "attendance" | "payslips" | "performance";
const date = (value: string) => formatDate(`${value}T12:00:00Z`);

export function EmployeePortalPage({ section }: { section: Section }) {
  const { state, workspace, role, year, now, todayIso, act } = usePeople();
  const toast = useToast();
  const [leaveType, setLeaveType] = useState<LeaveType>("Annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const email = myEmployeeEmail(workspace, role);
  const me = state.employees.find((e) => e.email.toLowerCase() === email);
  if (!me) return <Panel title="Your account is not linked yet"><EmptyState title="Ask HR to link your employee record">Your work email is {email}. HR can connect your account by adding that same email to the employee directory.</EmptyState></Panel>;

  if (section === "profile") return <EmployeeProfile employeeId={me.id} />;

  const title: Record<Exclude<Section, "profile">, string> = {
    leave: "My leave", attendance: "My attendance", payslips: "My payslips", performance: "My performance",
  };
  const intro: Record<Exclude<Section, "profile">, string> = {
    leave: "Your leave balance, upcoming time off, and request history.",
    attendance: "Clock in for today and review your recent attendance.",
    payslips: "Payslips from payroll runs approved by your company.",
    performance: "Your review progress and the goals shared with the team.",
  };
  const balance = year ? leaveBalance(state, me.id, year) : null;
  const leave = state.leave.filter((l) => l.employeeId === me.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const records = state.attendance.filter((r) => r.employeeId === me.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const approved = new Map(state.payrollRuns.filter((r) => r.status === "Approved").map((r) => [r.id, r]));
  const slips = state.payrollLines.filter((l) => l.employeeId === me.id && approved.has(l.runId)).sort((a, b) => approved.get(b.runId)!.period.localeCompare(approved.get(a.runId)!.period));
  const reviews = [...state.reviews].filter((r) => r.employeeId === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const today = now ? lagosDate(now.toISOString()) : todayIso;
  const holidays = start && end ? holidaysForState(state, start, end) : new Map<string, string>();
  const requestedDays = start && end ? workingDays(start, end, holidays) : 0;

  function submitLeave(event: FormEvent) {
    event.preventDefault();
    if (!start || !end) return setError("Choose your first and last day.");
    if (end < start) return setError("Your last day is before your first day.");
    if (requestedDays < 1) return setError("Those dates include no working days. Choose at least one working day.");
    if (leaveType === "Annual" && balance && requestedDays > balance.remaining - balance.pending) return setError(`That is more than your remaining annual leave (${balance.remaining - balance.pending} days after pending requests).`);
    setError("");
    act({ type: "leave/request", input: { employeeId: me.id, leaveType, startDate: start, endDate: end, reason } });
    toast("Leave request sent for approval.");
    setStart(""); setEnd(""); setReason("");
  }

  return (
    <>
      <PageHeader eyebrow="My space" title={title[section]} intro={intro[section]} actions={<Link className="btn" href="/me">Back to my dashboard</Link>} />
      {section === "leave" ? <>
        <div className="stats employee-stats">
          <StatCard label="Annual leave left" value={balance?.remaining ?? "—"} foot={balance ? `of ${balance.allowance} days this year` : "Balance unavailable"} icon="calendar" tone="green" />
          <StatCard label="Pending requests" value={leave.filter((l) => l.status === "Pending").length} foot="Awaiting a decision" icon="clock" tone="orange" />
          <StatCard label="Days taken" value={balance?.taken ?? "—"} foot="Annual leave this year" icon="check" tone="blue" />
        </div>
        <Panel title="Request time off" subtitle="Your manager or HR will review your request.">
          <form className="panel-body" onSubmit={submitLeave} noValidate>
            <div className="form-grid">
              <Field label="Type of leave">{(p) => <select {...p} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
              <div className="field"><span className="label">Working days</span><strong className="me-days" aria-live="polite">{requestedDays}</strong></div>
              <Field label="First day">{(p) => <input {...p} type="date" value={start} min={today ?? undefined} onChange={(e) => setStart(e.target.value)} />}</Field>
              <Field label="Last day">{(p) => <input {...p} type="date" value={end} min={start || today || undefined} onChange={(e) => setEnd(e.target.value)} />}</Field>
              {holidays.size ? <p className="stat-foot field full" style={{ margin: 0 }}>Not counted: {[...holidays.values()].join(", ")}.</p> : null}
              <Field label="Note for your manager (optional)" full hint="No medical details needed.">{(p) => <textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
            </div>
            {error ? <p className="auth-error" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}
            <div className="modal-actions"><button className="btn primary"><Icon name="calendar" size={15} /> Send request</button></div>
          </form>
        </Panel>
        <Panel title="Request history" subtitle={`${pluralise(leave.length, "request")}${today ? ` · today is ${date(today)}` : ""}`}>
          {leave.length ? <ul className="list">{leave.map((l) => <li className="list-row" key={l.id}><div className="person-info"><strong>{l.leaveType} · {pluralise(l.days, "day")}</strong><span>{date(l.startDate)}{l.endDate !== l.startDate ? ` to ${date(l.endDate)}` : ""}{l.decidedBy ? ` · ${l.decidedBy}` : ""}</span></div><Badge tone={l.status === "Approved" ? "ok" : l.status === "Declined" ? "bad" : l.status === "Pending" ? "warn" : "neutral"}>{l.status}</Badge></li>)}</ul> : <EmptyState title="No leave requests yet">When you request time off, it will appear here.</EmptyState>}
        </Panel>
      </> : null}
      {section === "attendance" ? <>
        <ClockCard me={me} />
        <Panel title="Recent attendance" subtitle="Times shown in Lagos time">
          {records.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Work mode</th></tr></thead><tbody>{records.map((r) => <tr key={r.id}><td>{date(r.date)}</td><td>{lagosTime(r.clockIn)}</td><td>{r.clockOut ? lagosTime(r.clockOut) : "—"}</td><td>{r.mode}</td></tr>)}</tbody></table></div> : <EmptyState title="No attendance records yet">Your clock-ins will appear here.</EmptyState>}
        </Panel>
      </> : null}
      {section === "payslips" ? <Panel title="Approved payslips" subtitle="Only approved payroll is visible here">
        {slips.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Pay period</th><th>Gross</th><th>Net pay</th><th>Status</th></tr></thead><tbody>{slips.map((l) => <tr key={l.id}><td>{periodLabel(approved.get(l.runId)!.period)}</td><td>{formatNaira(Math.round(l.gross))}</td><td><strong>{formatNaira(Math.round(l.net))}</strong></td><td><Badge tone="ok">Approved</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No payslips yet">Your payslips appear here after HR approves a payroll run.</EmptyState>}
      </Panel> : null}
      {section === "performance" ? <>
        <Panel title="My reviews" subtitle="Your manager will share feedback here">
          {reviews.length ? <ul className="list">{reviews.map((r) => <li key={r.id} className="list-row"><div className="person-info"><strong>{r.cycle}</strong><span>{r.reviewerName ? `Reviewer: ${r.reviewerName}` : "No reviewer assigned"}{r.rating ? ` · ${r.rating}/5` : ""}</span></div><Badge tone={r.status === "Completed" ? "ok" : "info"}>{r.status}</Badge></li>)}</ul> : <EmptyState title="No review started yet">Your manager will start a review when the next cycle opens.</EmptyState>}
        </Panel>
        <Panel title="Company goals" subtitle="Shared priorities and progress">
          {state.goals.length ? <ul className="goal-list">{state.goals.map((g) => <li key={g.id} className="goal"><div className="goal-main"><strong>{g.title}</strong><span>{g.ownerName} · due {date(g.dueDate)}</span><div className="bar goal-bar" aria-label={`${g.progress}% complete`}><i style={{ width: `${g.progress}%` }} /></div></div><strong>{g.progress}%</strong></li>)}</ul> : <EmptyState title="No company goals published yet">Check back when your team shares its priorities.</EmptyState>}
        </Panel>
      </> : null}
    </>
  );
}
