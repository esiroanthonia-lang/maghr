"use client";

import { useState, type FormEvent } from "react";
import { formatDate, pluralise } from "@/lib/format";
import { holidaysForState, leaveBalance, onLeaveOn, toCsv, workingDays, type LeaveInput } from "@/lib/people";
import { LEAVE_STATUSES, LEAVE_TYPES, type LeaveStatus, type LeaveType } from "@/lib/types";
import { Avatar, Badge, EmptyState, PageHeader, Panel, RelativeTime, StatCard } from "../ui/bits";
import { downloadText } from "../ui/download";
import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { AttendanceBoard } from "./Attendance";
import { usePeople } from "./usePeople";

const d = (iso: string) => formatDate(`${iso}T12:00:00Z`);
const tone = (s: LeaveStatus) => (s === "Approved" ? "ok" : s === "Pending" ? "warn" : s === "Declined" ? "bad" : "neutral");

function LeaveForm({ onSubmit, onCancel }: { onSubmit: (input: LeaveInput) => void; onCancel: () => void }) {
  const { state } = usePeople();
  const people = state.employees.filter((e) => e.status !== "Exited");
  const today = new Date().toISOString().slice(0, 10);
  const [input, setInput] = useState<LeaveInput>({ employeeId: people[0]?.id ?? "", leaveType: "Annual", startDate: today, endDate: today, reason: "" });
  const [error, setError] = useState("");
  const hols = holidaysForState(state, input.startDate, input.endDate);
  const days = workingDays(input.startDate, input.endDate, hols);
  const set = <K extends keyof LeaveInput>(k: K, v: LeaveInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.employeeId) return setError("Choose an employee.");
    if (input.endDate < input.startDate) return setError("The end date is before the start date.");
    if (days < 1) return setError("Those dates are a weekend. Choose at least one working day.");
    setError("");
    onSubmit(input);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Employee" required full>
          {(p) => (
            <select {...p} data-autofocus value={input.employeeId} onChange={(e) => set("employeeId", e.target.value)}>
              {people.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.department}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Leave type">
          {(p) => (
            <select {...p} value={input.leaveType} onChange={(e) => set("leaveType", e.target.value as LeaveType)}>
              {LEAVE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="field">
          <span className="label">Working days</span>
          <strong style={{ fontSize: 20, padding: "6px 0" }} aria-live="polite">
            {days}
          </strong>
        </div>
        <Field label="First day" required>
          {(p) => <input {...p} type="date" value={input.startDate} onChange={(e) => set("startDate", e.target.value)} />}
        </Field>
        <Field label="Last day" required>
          {(p) => <input {...p} type="date" value={input.endDate} min={input.startDate} onChange={(e) => set("endDate", e.target.value)} />}
        </Field>
        <Field label="Reason (optional)" full hint="Don’t include medical details. A short note is enough.">
          {(p) => <textarea {...p} rows={2} value={input.reason} onChange={(e) => set("reason", e.target.value)} />}
        </Field>
      </div>
      {error ? (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
      <p className="stat-foot" style={{ marginTop: 10 }}>
        Counts Monday–Friday and skips public and company holidays
        {hols.size ? ` (${[...hols.values()].join(", ")})` : ""}.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Record request
        </button>
      </div>
    </form>
  );
}

export function LeaveView() {
  const { state, act, can, todayIso, year } = usePeople();
  const toast = useToast();
  const [tab, setTab] = useState<"requests" | "out" | "balances" | "attendance">("requests");
  const [filter, setFilter] = useState<LeaveStatus | "all">("Pending");
  const [showForm, setShowForm] = useState(false);
  const name = (id: string) => state.employees.find((e) => e.id === id)?.name ?? "Unknown";

  const pending = state.leave.filter((l) => l.status === "Pending");
  const outToday = todayIso ? onLeaveOn(state, todayIso) : [];
  const horizon = todayIso ? new Date(Date.parse(`${todayIso}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10) : "";
  const upcoming = todayIso
    ? state.leave.filter((l) => l.status === "Approved" && l.endDate >= todayIso && l.startDate <= horizon).sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];
  const takenThisYear = year ? state.leave.filter((l) => l.status === "Approved" && l.startDate.startsWith(String(year))).reduce((n, l) => n + l.days, 0) : 0;
  const list = state.leave.filter((l) => filter === "all" || l.status === filter);
  const canDecide = can("leave/decide");

  function decide(id: string, status: "Approved" | "Declined") {
    act({ type: "leave/decide", leaveId: id, status });
    toast(`Leave ${status.toLowerCase()}.`);
  }

  return (
    <>
      <PageHeader
        eyebrow="TIME AWAY, MADE CLEAR"
        title="Leave & attendance"
        intro="Requests, approvals, balances and who’s out, all in one place."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadText(
                  `membra-leave-${todayIso ?? "export"}.csv`,
                  toCsv(state.leave.map((l) => ({ Employee: name(l.employeeId), Type: l.leaveType, From: l.startDate, To: l.endDate, Days: l.days, Status: l.status, "Decided by": l.decidedBy }))),
                )
              }
            >
              <Icon name="doc" size={15} /> Export CSV
            </button>
            {can("leave/request") ? (
              <button type="button" className="btn primary" onClick={() => setShowForm(true)}>
                <Icon name="plus" size={15} /> Record leave
              </button>
            ) : null}
          </>
        }
      />

      <div className="stats">
        <StatCard label="Out today" icon="calendar" tone="orange" value={outToday.length} foot={outToday.length ? outToday.map((l) => name(l.employeeId).split(" ")[0]).join(", ") : "Everyone’s in"} />
        <StatCard label="Waiting for a decision" icon="bell" tone="blue" value={pending.length} foot={pending.length ? "Oldest first in the list" : "All caught up"} />
        <StatCard label={`Days taken in ${year ?? ""}`} icon="clock" tone="green" value={takenThisYear} foot="Approved working days, all types" />
        <StatCard label="Annual allowance" icon="people" tone="purple" value={`${state.settings.leaveAllowanceDays} days`} foot="Change in Settings" />
      </div>

      <div className="tabs" role="tablist" aria-label="Leave sections">
        {(
          [
            ["requests", "Requests", pending.length],
            ["out", "Who’s out", upcoming.length],
            ["balances", "Balances", null],
            ["attendance", "Attendance", null],
          ] as const
        ).map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {label}
            {count !== null ? <span className="count">{count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "attendance" ? <AttendanceBoard /> : null}

      {tab === "requests" ? (
        <>
          <div className="toolbar">
            <div className="filters">
              <label className="sr-only" htmlFor="leave-filter">
                Status
              </label>
              <select id="leave-filter" className="control" value={filter} onChange={(e) => setFilter(e.target.value as LeaveStatus | "all")}>
                <option value="all">All requests</option>
                {LEAVE_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <Panel title="Leave requests" subtitle={canDecide ? "Approve or decline. Your name is recorded on each decision." : "View only"}>
            {list.length === 0 ? (
              <EmptyState title={filter === "Pending" ? "No requests waiting" : "No requests"}>{filter === "Pending" ? "New requests will appear here." : null}</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Employee</th>
                      <th scope="col">Type</th>
                      <th scope="col">Dates</th>
                      <th scope="col">Days</th>
                      <th scope="col">Requested</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((l) => {
                      const bal = year ? leaveBalance(state, l.employeeId, year) : null;
                      const over = l.leaveType === "Annual" && l.status === "Pending" && bal && l.days > bal.remaining;
                      return (
                        <tr key={l.id} data-leave={l.id}>
                          <td>
                            <span className="row-btn" style={{ cursor: "default" }}>
                              <Avatar name={name(l.employeeId)} />
                              <span className="person-info">
                                <strong>{name(l.employeeId)}</strong>
                                <span>{l.reason || "—"}</span>
                              </span>
                            </span>
                          </td>
                          <td>{l.leaveType}</td>
                          <td>
                            {d(l.startDate)}
                            {l.endDate !== l.startDate ? ` – ${d(l.endDate)}` : ""}
                          </td>
                          <td>
                            {l.days}
                            {over ? (
                              <span className="badge warn" style={{ marginLeft: 6 }} title="More than the remaining annual balance">
                                Over balance
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <RelativeTime iso={l.createdAt} />
                          </td>
                          <td>
                            {l.status === "Pending" && canDecide ? (
                              <div className="button-row">
                                <button type="button" className="btn small" onClick={() => decide(l.id, "Approved")} aria-label={`Approve leave for ${name(l.employeeId)}`}>
                                  Approve
                                </button>
                                <button type="button" className="btn small" onClick={() => decide(l.id, "Declined")} aria-label={`Decline leave for ${name(l.employeeId)}`}>
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <span title={l.decidedBy ? `By ${l.decidedBy}` : undefined}>
                                <Badge tone={tone(l.status)}>{l.status}</Badge>
                                {l.decidedBy ? <span className="stat-foot"> · {l.decidedBy}</span> : null}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}

      {tab === "out" ? (
        <Panel title="Who’s out" subtitle="Approved leave today and over the next 14 days">
          {upcoming.length === 0 ? (
            <EmptyState title="Nobody is booked off in the next two weeks" />
          ) : (
            <ul className="list">
              {upcoming.map((l) => (
                <li key={l.id} className="list-row">
                  <Avatar name={name(l.employeeId)} />
                  <div className="person-info">
                    <strong>{name(l.employeeId)}</strong>
                    <span>
                      {l.leaveType} · {d(l.startDate)} – {d(l.endDate)} · {pluralise(l.days, "day")}
                    </span>
                  </div>
                  {todayIso && l.startDate <= todayIso ? <Badge tone="warn">Out now</Badge> : <Badge tone="info">Upcoming</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === "balances" ? (
        <Panel title={`Annual leave balances ${year ?? ""}`} subtitle={`Allowance ${state.settings.leaveAllowanceDays} days per person. Approved annual leave only.`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Taken</th>
                  <th scope="col">Pending</th>
                  <th scope="col">Remaining</th>
                  <th scope="col" style={{ width: "30%" }}>
                    Used
                  </th>
                </tr>
              </thead>
              <tbody>
                {year
                  ? state.employees
                      .filter((e) => e.status !== "Exited")
                      .map((e) => {
                        const b = leaveBalance(state, e.id, year);
                        const pct = b.allowance ? Math.min(100, Math.round((b.taken / b.allowance) * 100)) : 0;
                        return (
                          <tr key={e.id}>
                            <td className="cell-strong">{e.name}</td>
                            <td>{b.taken}</td>
                            <td>{b.pending}</td>
                            <td className="cell-strong">{b.remaining}</td>
                            <td>
                              <div className="bar" aria-label={`${pct}% used`}>
                                <i style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {showForm ? (
        <Modal title="Record a leave request" onClose={() => setShowForm(false)}>
          <LeaveForm
            onCancel={() => setShowForm(false)}
            onSubmit={(input) => {
              act({ type: "leave/request", input });
              setShowForm(false);
              setTab("requests");
              setFilter("Pending");
              toast(`Leave request recorded for ${name(input.employeeId)}.`);
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
