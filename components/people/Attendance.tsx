"use client";

import { useState } from "react";
import { hoursWorked, isLate, lagosDate, lagosTime, lastDays, LATE_GRACE_MINUTES } from "@/lib/attendance";
import { onLeaveOn, toCsv } from "@/lib/people";
import { WORK_MODES, type AttendanceRecord, type Employee, type WorkMode } from "@/lib/types";
import { Avatar, Badge, EmptyState, Panel, StatCard } from "../ui/bits";
import { downloadText } from "../ui/download";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { usePeople } from "./usePeople";

const fmtHours = (h: number | null) => (h === null ? "—" : `${h.toFixed(1)} h`);
const weekday = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/** My space: clock in and out for today, plus the last few days. */
export function ClockCard({ me }: { me: Employee }) {
  const { state, act, can, now } = usePeople();
  const toast = useToast();
  const [mode, setMode] = useState<WorkMode>(me.location.includes("Remote") ? "Remote" : me.location.includes("Field") ? "Field" : "Office");
  if (!now) return null;
  const today = lagosDate(now.toISOString());
  const rec = state.attendance.find((r) => r.employeeId === me.id && r.date === today);
  const recent = state.attendance
    .filter((r) => r.employeeId === me.id && r.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const onLeave = onLeaveOn(state, today).some((l) => l.employeeId === me.id);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();

  return (
    <Panel title="Today" subtitle={weekday(today)}>
      <div className="panel-body clock">
        {rec ? (
          <div className="clock-state">
            <div>
              <span className="clock-label">{rec.clockOut ? "Day done" : "Clocked in"}</span>
              <strong className="clock-time">
                {lagosTime(rec.clockIn)}
                {rec.clockOut ? ` – ${lagosTime(rec.clockOut)}` : ""}
              </strong>
              <span className="stat-foot">
                {rec.mode} · {fmtHours(hoursWorked(rec, now))}
                {rec.clockOut ? "" : " so far"}
                {isLate(rec, state.settings.workStart) ? " · after start time" : ""}
              </span>
            </div>
            {!rec.clockOut && can("attendance/clockOut") ? (
              <button
                type="button"
                className="btn dark"
                onClick={() => {
                  act({ type: "attendance/clockOut", recordId: rec.id });
                  toast("Clocked out. See you tomorrow.");
                }}
              >
                <Icon name="clock" size={15} /> Clock out
              </button>
            ) : null}
          </div>
        ) : (
          <div className="clock-state">
            <div>
              <span className="clock-label">{onLeave ? "You’re on leave today" : dow === 0 || dow === 6 ? "It’s the weekend" : "Not clocked in yet"}</span>
              <span className="stat-foot">Work starts at {state.settings.workStart}. Your time is taken from the server clock.</span>
            </div>
            {can("attendance/clockIn") && me.status !== "Exited" ? (
              <div className="clock-actions">
                <label className="sr-only" htmlFor="clock-mode">
                  Working from
                </label>
                <select id="clock-mode" className="control" value={mode} onChange={(e) => setMode(e.target.value as WorkMode)}>
                  {WORK_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    act({ type: "attendance/clockIn", employeeId: me.id, mode });
                    toast(`Clocked in (${mode.toLowerCase()}).`);
                  }}
                >
                  <Icon name="clock" size={15} /> Clock in
                </button>
              </div>
            ) : null}
          </div>
        )}
        {recent.length ? (
          <ul className="clock-recent" aria-label="Recent days">
            {recent.map((r) => (
              <li key={r.id}>
                <span>{weekday(r.date)}</span>
                <span>
                  {lagosTime(r.clockIn)} – {r.clockOut ? lagosTime(r.clockOut) : "no clock-out"}
                </span>
                <span>{fmtHours(hoursWorked(r))}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

function CorrectRow({ record, onDone }: { record: AttendanceRecord; onDone: () => void }) {
  const { act } = usePeople();
  const toast = useToast();
  const [inT, setIn] = useState(lagosTime(record.clockIn));
  const [outT, setOut] = useState(record.clockOut ? lagosTime(record.clockOut) : "");
  return (
    <form
      className="correct-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (outT && outT <= inT) return toast("Clock-out must be after clock-in.");
        act({ type: "attendance/correct", recordId: record.id, clockIn: inT, clockOut: outT || null });
        toast("Attendance corrected. Your name is recorded on the change.");
        onDone();
      }}
    >
      <label htmlFor={`in-${record.id}`}>In</label>
      <input id={`in-${record.id}`} className="control" type="time" value={inT} required onChange={(e) => setIn(e.target.value)} />
      <label htmlFor={`out-${record.id}`}>Out</label>
      <input id={`out-${record.id}`} className="control" type="time" value={outT} onChange={(e) => setOut(e.target.value)} />
      <button className="btn small dark">Save</button>
      <button type="button" className="btn small" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

/** Leave & attendance page: who's in today, lateness, and the last week. */
export function AttendanceBoard() {
  const { state, can, now } = usePeople();
  const [editing, setEditing] = useState<string | null>(null);
  if (!now) return null;
  const today = lagosDate(now.toISOString());
  const staff = state.employees.filter((e) => e.status !== "Exited" && e.startDate <= today);
  const todays = new Map(state.attendance.filter((r) => r.date === today).map((r) => [r.employeeId, r]));
  const onLeave = new Set(onLeaveOn(state, today).map((l) => l.employeeId));
  const inNow = staff.filter((e) => todays.has(e.id));
  const late = inNow.filter((e) => isLate(todays.get(e.id)!, state.settings.workStart));
  const away = inNow.filter((e) => todays.get(e.id)!.mode !== "Office");
  const missing = staff.filter((e) => !todays.has(e.id) && !onLeave.has(e.id));
  const week = lastDays(today, 7).filter((d) => {
    const w = new Date(`${d}T00:00:00Z`).getUTCDay();
    return w !== 0 && w !== 6;
  });
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekend = dow === 0 || dow === 6;

  const order = (e: Employee) => (todays.has(e.id) ? 0 : onLeave.has(e.id) ? 2 : 1);
  const rows = [...staff].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));

  function exportCsv() {
    const from = lastDays(today, 30)[0];
    const recs = state.attendance.filter((r) => r.date >= from).sort((a, b) => a.date.localeCompare(b.date));
    const name = (id: string) => state.employees.find((e) => e.id === id)?.name ?? "Unknown";
    downloadText(
      `maghr-attendance-${today}.csv`,
      toCsv(
        recs.map((r) => ({
          Date: r.date,
          Employee: name(r.employeeId),
          "Working from": r.mode,
          "Clock in (Lagos)": lagosTime(r.clockIn),
          "Clock out (Lagos)": r.clockOut ? lagosTime(r.clockOut) : null,
          Hours: hoursWorked(r),
          Late: isLate(r, state.settings.workStart) ? "Yes" : "No",
          "Corrected by": r.correctedBy || null,
        })),
      ),
    );
  }

  return (
    <>
      <div className="stats">
        <StatCard label="In today" icon="check" tone="green" value={inNow.length} foot={`of ${staff.length} staff`} />
        <StatCard label="Late today" icon="clock" tone="orange" value={late.length} foot={`After ${state.settings.workStart} + ${LATE_GRACE_MINUTES} min`} />
        <StatCard label="Remote or field" icon="pin" tone="blue" value={away.length} foot="Of those in today" />
        <StatCard label="Not clocked in" icon="bell" tone="purple" value={weekend ? 0 : missing.length} foot={weekend ? "Weekend" : `${onLeave.size} more on approved leave`} />
      </div>

      <Panel
        title="Today"
        subtitle="Clock times come from the server, in Lagos time"
        action={
          <button type="button" className="btn small" onClick={exportCsv}>
            <Icon name="doc" size={14} /> Export last 30 days
          </button>
        }
      >
        {staff.length === 0 ? (
          <EmptyState title="No staff yet" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Attendance today</caption>
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Status</th>
                  <th scope="col">Working from</th>
                  <th scope="col">In</th>
                  <th scope="col">Out</th>
                  <th scope="col">Hours</th>
                  {can("attendance/correct") ? <th scope="col">Fix</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const r = todays.get(e.id);
                  return (
                    <tr key={e.id} data-attendance={e.name}>
                      <td>
                        <span className="row-btn" style={{ cursor: "default" }}>
                          <Avatar name={e.name} />
                          <span className="person-info">
                            <strong>{e.name}</strong>
                            <span>{e.department}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {r ? (
                          <Badge tone={r.clockOut ? "neutral" : "ok"}>{r.clockOut ? "Left" : "In"}</Badge>
                        ) : onLeave.has(e.id) ? (
                          <Badge tone="info">On leave</Badge>
                        ) : (
                          <Badge tone={weekend ? "neutral" : "warn"}>Not in</Badge>
                        )}
                      </td>
                      <td>{r ? r.mode : "—"}</td>
                      <td>
                        {r ? lagosTime(r.clockIn) : "—"}
                        {r && isLate(r, state.settings.workStart) ? (
                          <span className="badge warn" style={{ marginLeft: 6 }}>
                            Late
                          </span>
                        ) : null}
                      </td>
                      <td>{r?.clockOut ? lagosTime(r.clockOut) : "—"}</td>
                      <td>
                        {r ? fmtHours(hoursWorked(r, now)) : "—"}
                        {r?.correctedBy ? (
                          <span className="stat-foot" title={`Corrected by ${r.correctedBy}`}>
                            {" "}
                            · corrected
                          </span>
                        ) : null}
                      </td>
                      {can("attendance/correct") ? (
                        <td>
                          {r ? (
                            editing === r.id ? (
                              <CorrectRow record={r} onDone={() => setEditing(null)} />
                            ) : (
                              <button type="button" className="btn small" onClick={() => setEditing(r.id)} aria-label={`Correct times for ${e.name}`}>
                                Correct
                              </button>
                            )
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Last 7 days" subtitle="Working days only. Green: clocked in on time. Orange: late. Blue ring: on leave. Dashed: not clocked in.">
        <div className="table-wrap">
          <table className="data-table week-grid">
            <caption className="sr-only">Attendance for the last 7 days</caption>
            <thead>
              <tr>
                <th scope="col">Employee</th>
                {week.map((d) => (
                  <th scope="col" key={d}>
                    {weekday(d).split(" ")[0]} {weekday(d).split(" ")[1]}
                  </th>
                ))}
                <th scope="col">Days in</th>
                <th scope="col">Avg hours</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((e) => {
                const recs = week.map((d) => state.attendance.find((r) => r.employeeId === e.id && r.date === d));
                const done = recs.filter((r): r is AttendanceRecord => Boolean(r?.clockOut));
                const avg = done.length ? done.reduce((n, r) => n + (hoursWorked(r) ?? 0), 0) / done.length : null;
                return (
                  <tr key={e.id}>
                    <td className="cell-strong">{e.name}</td>
                    {recs.map((r, i) => {
                      const leave = state.leave.some((l) => l.employeeId === e.id && l.status === "Approved" && l.startDate <= week[i] && l.endDate >= week[i]);
                      const lateDay = r ? isLate(r, state.settings.workStart) : false;
                      const label = r ? `In ${lagosTime(r.clockIn)}${lateDay ? ", late" : ""}` : leave ? "On leave" : "Not in";
                      return (
                        <td key={week[i]} title={label}>
                          <span className={`day-dot ${r ? (lateDay ? "late" : "in") : leave ? "leave" : "out"}`} aria-label={label} role="img" />
                        </td>
                      );
                    })}
                    <td>{recs.filter(Boolean).length}</td>
                    <td>{avg === null ? "—" : `${avg.toFixed(1)} h`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
