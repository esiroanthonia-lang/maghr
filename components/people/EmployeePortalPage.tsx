"use client";

import { useState, type FormEvent } from "react";
import { formatDate, pluralise } from "@/lib/format";
import { lagosDate, lagosTime } from "@/lib/attendance";
import { formatNaira, holidaysForState, leaveBalance, periodLabel, workingDays } from "@/lib/people";
import { myEmployeeEmail } from "@/lib/workspace";
import { LEAVE_TYPES, type LeaveType } from "@/lib/types";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/bits";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { usePeople } from "./usePeople";
import { ClockCard } from "./Attendance";
import { EmployeeProfile } from "./EmployeeProfile";
import { Modal } from "../ui/Modal";
import { PayslipCard, printPayslip } from "./Payslip";

type Section = "profile" | "leave" | "attendance" | "payslips" | "performance";
const date = (value: string) => formatDate(`${value}T12:00:00Z`);

export function EmployeePortalPage({ section }: { section: Section }) {
  const { state, workspace, role, year, now, todayIso, act, saving } = usePeople();
  const toast = useToast();
  const [leaveType, setLeaveType] = useState<LeaveType>("Annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [slipId, setSlipId] = useState<string | null>(null);
  const email = myEmployeeEmail(workspace, role);
  const me = state.employees.find((e) => e.email.toLowerCase() === email);
  if (!me) return <Panel title="Your account is not linked yet"><EmptyState title="Ask HR to link your employee record">Your work email is {email}. HR can connect your account by adding that same email to the employee directory.</EmptyState></Panel>;
  const employeeId = me.id;

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
  const openSlip = slips.find((l) => l.id === slipId);
  const reviews = [...state.reviews].filter((r) => r.employeeId === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const employeeGoals = state.goals.filter((goal) => goal.ownerName.trim().toLowerCase() === me.name.trim().toLowerCase()).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const latestReview = reviews[0] ?? null;
  const goalProgress = employeeGoals.length ? Math.round(employeeGoals.reduce((total, goal) => total + goal.progress, 0) / employeeGoals.length) : null;
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
    act({ type: "leave/request", input: { employeeId, leaveType, startDate: start, endDate: end, reason } });
    toast("Leave request sent for approval.");
    setStart(""); setEnd(""); setReason("");
  }

  return (
    <>
      <PageHeader eyebrow="My space" title={title[section]} intro={intro[section]} />
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
        {slips.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Pay period</th><th className="col-m-hide">Gross</th><th>Net pay</th><th className="col-m-hide">Status</th><th>Payslip</th></tr></thead><tbody>{slips.map((l) => <tr key={l.id}><td>{periodLabel(approved.get(l.runId)!.period)}</td><td className="col-m-hide">{formatNaira(Math.round(l.gross))}</td><td><strong>{formatNaira(Math.round(l.net))}</strong></td><td className="col-m-hide"><Badge tone="ok">Approved</Badge></td><td><button type="button" className="btn small" onClick={() => setSlipId(l.id)}>View<span className="hide-m"> and download</span></button></td></tr>)}</tbody></table></div> : <EmptyState title="No payslips yet">Your payslips appear here after HR approves a payroll run. If a run was approved and yours is missing, ask HR to check that your pay is set and your work email matches your sign-in email.</EmptyState>}
        {openSlip ? <Modal title={`Payslip · ${periodLabel(approved.get(openSlip.runId)!.period)}`} onClose={() => setSlipId(null)}>
          <PayslipCard company={state.settings.companyName} period={periodLabel(approved.get(openSlip.runId)!.period)} name={me.name} detail={`${me.jobTitle} · ${me.department}`} slip={openSlip} estimate={false} status="Approved" />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setSlipId(null)}>Close</button>
            <button type="button" className="btn dark" onClick={printPayslip}><Icon name="doc" size={15} /> Download PDF</button>
          </div>
        </Modal> : null}
      </Panel> : null}
      {section === "performance" ? <>
        <div className="employee-performance-dashboard">
          <Panel title="My profile" subtitle="Your role and department">
            <div className="employee-performance-profile">
              <Avatar name={me.name} large />
              <div><strong>{me.name}</strong><span>{me.jobTitle}</span><small>{me.department}</small><small>{me.managerName ? `Manager: ${me.managerName}` : "Manager not assigned"}</small></div>
            </div>
          </Panel>
          <Panel title="Performance overview" subtitle={latestReview ? `Latest review · ${latestReview.cycle}` : "Your review history"}>
            <div className="employee-performance-score">
              <div className="employee-rating-ring" style={{ background: `conic-gradient(var(--accent) ${(latestReview?.rating ?? 0) * 20}%, var(--line) 0)` }}><div><strong>{latestReview?.rating ?? "—"}{latestReview?.rating ? <small>/5</small> : null}</strong><span>{latestReview?.rating ? "Overall rating" : "Not rated"}</span></div></div>
              <div className="employee-performance-facts">
                <div><span>Review status</span><strong>{latestReview?.status ?? "Not started"}</strong></div>
                <div><span>Reviewer</span><strong>{latestReview?.reviewerName || "Not assigned"}</strong></div>
                <div><span>Review cycles</span><strong>{reviews.length}</strong></div>
              </div>
            </div>
          </Panel>
          <Panel title="My goals" subtitle={employeeGoals.length ? `${pluralise(employeeGoals.length, "goal")} assigned to you` : "Set with your manager"}>
            {employeeGoals.length ? <ul className="employee-goal-summary">{employeeGoals.map((goal) => <li key={goal.id}><div><strong>{goal.title}</strong><span>Due {date(goal.dueDate)}</span></div><strong>{goal.progress}%</strong><div className="bar goal-bar"><i style={{ width: `${goal.progress}%` }} /></div></li>)}</ul> : <EmptyState title="No individual goals yet">Goals assigned to you will appear here.</EmptyState>}
          </Panel>
          <Panel title="Goal progress" subtitle="Across your assigned goals">
            <div className="employee-goal-progress">
              {goalProgress === null ? <span>Progress shows here once you have goals.</span> : <>
              <strong>{`${goalProgress}%`}</strong>
              <span>{employeeGoals.filter((goal) => goal.progress >= 100).length} of {pluralise(employeeGoals.length, "goal")} completed</span>
              <div className="bar goal-bar"><i style={{ width: `${goalProgress}%` }} /></div></>}
            </div>
          </Panel>
        </div>
        <Panel title="My reviews" subtitle="Complete your self-appraisal when your manager opens a review cycle.">
          {reviews.length ? <ul className="self-review-list">{reviews.map((r) => <li key={r.id} className="self-review-item">
            <div className="self-review-heading"><div className="person-info"><strong>{r.cycle}</strong><span>{r.reviewerName ? `Reviewer: ${r.reviewerName}` : "No reviewer assigned"}{r.rating ? ` · ${r.rating}/5` : ""}</span></div><Badge tone={r.status === "Completed" ? "ok" : r.status === "Manager review" ? "info" : "neutral"}>{r.status}</Badge></div>
            {r.status === "Self review" ? <SelfAppraisalForm disabled={saving} onSubmit={(selfAppraisal) => {
              act({ type: "review/selfAppraise", employeeId: me.id, cycle: r.cycle, selfAppraisal });
              toast(`Self-appraisal submitted for ${r.cycle}.`);
            }} /> : null}
            {r.selfAppraisal ? <div className="self-review-copy"><strong>Your self-appraisal</strong><p>{r.selfAppraisal}</p>{r.selfSubmittedAt ? <span>Submitted {formatDate(r.selfSubmittedAt)}</span> : null}</div> : null}
            {r.status === "Completed" && r.summary ? <div className="self-review-copy manager-feedback"><strong>Manager feedback</strong><p>{r.summary}</p></div> : null}
          </li>)}</ul> : <EmptyState title="No review started yet">Your manager will open a review cycle before you can submit a self-appraisal.</EmptyState>}
        </Panel>
        <Panel title="Shared team goals" subtitle="Department and company priorities">
          {state.goals.length ? <ul className="goal-list">{state.goals.map((g) => <li key={g.id} className="goal"><div className="goal-main"><strong>{g.title}</strong><span>{g.ownerName} · due {date(g.dueDate)}</span><div className="bar goal-bar" aria-label={`${g.progress}% complete`}><i style={{ width: `${g.progress}%` }} /></div></div><strong>{g.progress}%</strong></li>)}</ul> : <EmptyState title="No team goals published yet">Shared team goals will appear here when they’re published.</EmptyState>}
        </Panel>
      </> : null}
    </>
  );
}

function SelfAppraisalForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const appraisal = value.trim();
    if (appraisal.length < 10) return setError("Add a little more detail before submitting.");
    setError("");
    onSubmit(appraisal);
  }

  return <form className="self-appraisal-form" onSubmit={submit} noValidate>
    <Field label="Your self-appraisal" required full hint="What went well, what was challenging, and what support or goals would help next? Visible to your manager and HR.">
      {(props) => <textarea {...props} rows={5} maxLength={3000} value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} placeholder="Reflect on your work this cycle…" />}
    </Field>
    <div className="self-appraisal-actions"><span>{value.length} / 3,000</span><button type="submit" className="btn primary small" disabled={disabled || value.trim().length < 10}>Submit self-appraisal</button></div>
    {error ? <p className="auth-error" role="alert">{error}</p> : null}
  </form>;
}

