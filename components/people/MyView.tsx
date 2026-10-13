"use client";

import { useState, type FormEvent } from "react";
import { formatDate, pluralise } from "@/lib/format";
import { formatNaira, holidaysForState, leaveBalance, periodLabel, workingDays } from "@/lib/people";
import { LEAVE_TYPES, type LeaveType } from "@/lib/types";
import { myEmployeeEmail } from "@/lib/workspace";
import { Avatar, Badge, EmptyState, Notice, Panel } from "../ui/bits";
import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { ClockCard } from "./Attendance";
import { PayslipCard, printPayslip } from "./Payslip";
import { Modal } from "../ui/Modal";
import { OnboardingChecklist } from "./Onboarding";
import { usePeople } from "./usePeople";

const d = (iso: string) => formatDate(`${iso}T12:00:00Z`);

/** Self-service for whoever is signed in: their details, leave and review. */
export function MyView() {
  const { state, act, workspace, year, todayIso, now } = usePeople();
  const toast = useToast();
  const email = myEmployeeEmail(workspace);
  const me = state.employees.find((e) => e.email.toLowerCase() === email);
  const [leaveType, setLeaveType] = useState<LeaveType>("Annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [slipId, setSlipId] = useState<string | null>(null);
  const firstName = workspace.mode === "live" ? workspace.me.name.split(" ")[0] : me?.name.split(" ")[0];

  if (!me) {
    return (
      <>
        <section className="today today-compact" aria-labelledby="me-title">
          <div>
            <p className="today-date">My space</p>
            <h1 id="me-title">Hello{firstName ? `, ${firstName}` : ""}</h1>
          </div>
        </section>
        <Panel title="Your employee record isn’t linked yet">
          <EmptyState title="Ask HR to add you to the directory">
            Your account ({email}) will connect automatically once HR adds an employee record with the same email.
          </EmptyState>
        </Panel>
      </>
    );
  }

  const balance = year ? leaveBalance(state, me.id, year) : null;
  const myLeave = state.leave.filter((l) => l.employeeId === me.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const upcoming = todayIso ? myLeave.find((l) => l.status === "Approved" && l.endDate >= todayIso) : undefined;
  const review = [...state.reviews].filter((r) => r.employeeId === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const pay = state.pay[me.id];
  const approvedRuns = new Map(state.payrollRuns.filter((r) => r.status === "Approved").map((r) => [r.id, r]));
  const slips = state.payrollLines
    .filter((l) => l.employeeId === me.id && approvedRuns.has(l.runId))
    .sort((a, b) => approvedRuns.get(b.runId)!.period.localeCompare(approvedRuns.get(a.runId)!.period));
  const openSlip = slips.find((l) => l.id === slipId);
  const hols = start && end ? holidaysForState(state, start, end) : new Map<string, string>();
  const days = start && end ? workingDays(start, end, hols) : 0;
  const tenureYears = now ? Math.max(0, Math.floor((now.getTime() - Date.parse(`${me.startDate}T00:00:00Z`)) / (365.25 * 86400000))) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!start || !end) return setError("Choose your first and last day.");
    if (end < start) return setError("Your last day is before your first day.");
    if (days < 1) return setError("Those dates fall on a weekend. Choose at least one working day.");
    if (leaveType === "Annual" && balance && days > balance.remaining - balance.pending)
      return setError(`That’s more than your remaining annual leave (${balance.remaining - balance.pending} days after pending requests).`);
    setError("");
    act({ type: "leave/request", input: { employeeId: me!.id, leaveType, startDate: start, endDate: end, reason } });
    toast("Request sent to HR for approval.");
    setStart("");
    setEnd("");
    setReason("");
  }

  return (
    <>
      <section className="today today-compact" aria-labelledby="me-title">
        <div className="me-head">
          <Avatar name={me.name} large />
          <div>
            <p className="today-date">My space</p>
            <h1 id="me-title">Hello, {me.name.split(" ")[0]}</h1>
            <p className="me-sub">
              {me.jobTitle} in {me.department}
              {me.managerName ? `, reporting to ${me.managerName}` : ""}
            </p>
          </div>
        </div>
        <dl className="today-facts">
          <div>
            <dt>Annual leave left</dt>
            <dd>{balance ? balance.remaining : "—"}</dd>
          </div>
          <div>
            <dt>Pending requests</dt>
            <dd>{myLeave.filter((l) => l.status === "Pending").length}</dd>
          </div>
          <div>
            <dt>With us</dt>
            <dd>{tenureYears === null ? "—" : tenureYears < 1 ? "<1 yr" : pluralise(tenureYears, "yr")}</dd>
          </div>
        </dl>
      </section>

      {state.onboarding.some((t) => t.employeeId === me.id && !t.doneAt) ? (
        <Panel title="Your first weeks" subtitle="Tick off your steps as you go. HR and your manager handle the rest.">
          <div className="panel-body">
            <OnboardingChecklist employee={me} mode="self" />
          </div>
        </Panel>
      ) : null}

      <div className="dashboard-grid">
        <div>
          <ClockCard me={me} />
          <Panel title="Request time off" subtitle="Goes to HR and your manager for approval">
            <form className="panel-body" onSubmit={submit} noValidate>
              <div className="form-grid">
                <Field label="Type of leave">
                  {(p) => (
                    <select {...p} value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
                      {LEAVE_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <div className="field">
                  <span className="label">Working days</span>
                  <strong className="me-days" aria-live="polite">
                    {days}
                  </strong>
                </div>
                <Field label="First day">{(p) => <input {...p} type="date" value={start} min={todayIso ?? undefined} onChange={(e) => setStart(e.target.value)} />}</Field>
                <Field label="Last day">{(p) => <input {...p} type="date" value={end} min={start || todayIso || undefined} onChange={(e) => setEnd(e.target.value)} />}</Field>
                {hols.size ? (
                  <p className="stat-foot field full" style={{ margin: 0 }}>
                    Not counted: {[...hols.values()].join(", ")}.
                  </p>
                ) : null}
                <Field label="Note for your manager (optional)" full hint="No medical details needed.">
                  {(p) => <textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
                </Field>
              </div>
              {error ? (
                <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
                  {error}
                </p>
              ) : null}
              <div className="modal-actions">
                <button className="btn primary">
                  <Icon name="calendar" size={15} /> Send request
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="My leave" subtitle={balance ? `${balance.taken} of ${balance.allowance} annual days used in ${year}` : undefined}>
            {myLeave.length === 0 ? (
              <EmptyState title="No leave yet">Your requests and approvals will show here.</EmptyState>
            ) : (
              <ul className="list">
                {myLeave.map((l) => (
                  <li key={l.id} className="list-row" data-my-leave={l.id}>
                    <div className="person-info">
                      <strong>
                        {l.leaveType}, {pluralise(l.days, "day")}
                      </strong>
                      <span>
                        {d(l.startDate)}
                        {l.endDate !== l.startDate ? ` to ${d(l.endDate)}` : ""}
                        {l.decidedBy ? `. ${l.status} by ${l.decidedBy}` : ""}
                      </span>
                    </div>
                    {l.status === "Pending" ? (
                      <div className="button-row">
                        <Badge tone="warn">Pending</Badge>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => {
                            act({ type: "leave/cancel", leaveId: l.id });
                            toast("Request cancelled.");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <Badge tone={l.status === "Approved" ? "ok" : l.status === "Declined" ? "bad" : "neutral"}>{l.status}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="right-stack">
          <Panel title="My details" subtitle="Something wrong? Ask HR to update it.">
            <div className="panel-body">
              <dl className="kv">
                <dt>Email</dt>
                <dd>{me.email}</dd>
                <dt>Phone</dt>
                <dd>{me.phone || "—"}</dd>
                <dt>Location</dt>
                <dd>{me.location || "—"}</dd>
                <dt>Started</dt>
                <dd>{d(me.startDate)}</dd>
                <dt>Contract</dt>
                <dd>{me.employmentType}</dd>
                {typeof pay === "number" ? (
                  <>
                    <dt>Monthly gross</dt>
                    <dd>{formatNaira(pay)}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          </Panel>

          <Panel title="My payslips" subtitle={slips.length ? "From approved payroll runs" : undefined}>
            {slips.length === 0 ? (
              <EmptyState title="No payslips yet">They appear here once HR approves each month’s payroll.</EmptyState>
            ) : (
              <ul className="list">
                {slips.slice(0, 6).map((l) => (
                  <li key={l.id} className="list-row" data-slip={approvedRuns.get(l.runId)!.period}>
                    <div className="person-info">
                      <strong>{periodLabel(approvedRuns.get(l.runId)!.period)}</strong>
                      <span>Net {formatNaira(Math.round(l.net))}</span>
                    </div>
                    <button type="button" className="btn small" onClick={() => setSlipId(l.id)} aria-label={`View payslip for ${periodLabel(approvedRuns.get(l.runId)!.period)}`}>
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {upcoming ? (
            <Notice>
              Your next time off: <strong>{upcoming.leaveType}</strong>, {d(upcoming.startDate)} to {d(upcoming.endDate)}.
            </Notice>
          ) : null}

          <Panel title="My review" subtitle={review ? review.cycle : "No review yet"}>
            <div className="panel-body">
              {review ? (
                <p style={{ margin: 0, fontSize: 14 }}>
                  <strong>{review.status}</strong>
                  {review.rating ? `, rated ${review.rating} out of 5` : ""}
                  {review.reviewerName ? ` by ${review.reviewerName}` : ""}.
                </p>
              ) : (
                <p className="stat-foot" style={{ margin: 0 }}>
                  Your manager will start your review in the next cycle.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Company goals" subtitle="What we’re working towards">
            {state.goals.length === 0 ? (
              <EmptyState title="No goals published yet" />
            ) : (
              <ul className="goal-list">
                {state.goals.slice(0, 5).map((g) => (
                  <li key={g.id} className="goal">
                    <div className="goal-main">
                      <strong>{g.title}</strong>
                      <span>
                        {g.ownerName}, due {d(g.dueDate)}
                      </span>
                      <div className="bar goal-bar" aria-label={`${g.progress}% complete`}>
                        <i style={{ width: `${g.progress}%` }} />
                      </div>
                    </div>
                    <strong>{g.progress}%</strong>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {openSlip ? (
        <Modal title={`Payslip · ${periodLabel(approvedRuns.get(openSlip.runId)!.period)}`} onClose={() => setSlipId(null)}>
          <PayslipCard
            company={state.settings.companyName}
            period={periodLabel(approvedRuns.get(openSlip.runId)!.period)}
            name={me.name}
            detail={`${me.jobTitle} · ${me.department}`}
            slip={openSlip}
            estimate={false}
            status="Approved"
          />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setSlipId(null)}>
              Close
            </button>
            <button type="button" className="btn dark" onClick={printPayslip}>
              Print or save as PDF
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
