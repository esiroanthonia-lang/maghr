"use client";

import { useId, useMemo, useState } from "react";
import { formatDate, pluralise } from "@/lib/format";
import { formatNaira, leaveBalance, toCsv } from "@/lib/people";
import { DEPARTMENTS, EMPLOYEE_STATUSES, type Department, type Employee, type EmployeeStatus } from "@/lib/types";
import { Avatar, Badge, EmptyState, Notice, PageHeader, Panel, StatCard } from "../ui/bits";
import { downloadText } from "../ui/download";
import { Icon } from "../ui/Icon";
import { Modal, useDialogBehaviour } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { EmployeeForm } from "./EmployeeForm";
import { OnboardingChecklist, OnboardingPanel } from "./Onboarding";
import { usePeople } from "./usePeople";

const statusTone = (s: EmployeeStatus) => (s === "Active" ? "ok" : s === "Onboarding" ? "info" : "neutral");

function EmployeeDrawer({ employee, onClose, onEdit }: { employee: Employee; onClose: () => void; onEdit: () => void }) {
  const { state, act, can, isAdmin, year, todayIso } = usePeople();
  const toast = useToast();
  const ref = useDialogBehaviour(onClose);
  const titleId = useId();
  const [payDraft, setPayDraft] = useState("");
  const [exitDate, setExitDate] = useState<string | null>(null);
  const pay = state.pay[employee.id];
  const balance = year ? leaveBalance(state, employee.id, year) : null;
  const recentLeave = state.leave.filter((l) => l.employeeId === employee.id).slice(0, 5);
  const review = [...state.reviews].filter((r) => r.employeeId === employee.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const reports = state.employees.filter((e) => e.managerName === employee.name && e.status !== "Exited");

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer-head">
          <Avatar name={employee.name} large />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId}>{employee.name}</h2>
            <p>
              {employee.jobTitle} · {employee.department}
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <Badge tone={statusTone(employee.status)}>{employee.status}</Badge>
              <Badge tone="neutral">{employee.employmentType}</Badge>
            </div>
          </div>
          <button type="button" className="close" onClick={onClose} aria-label="Close employee profile">
            <Icon name="close" size={16} />
          </button>
        </div>

        <section className="drawer-section" aria-label="Details">
          <h3>Details</h3>
          <dl className="kv">
            <dt>Email</dt>
            <dd>{employee.email}</dd>
            <dt>Phone</dt>
            <dd>{employee.phone || "—"}</dd>
            <dt>Location</dt>
            <dd>{employee.location || "—"}</dd>
            <dt>Manager</dt>
            <dd>{employee.managerName || "—"}</dd>
            <dt>Started</dt>
            <dd>{formatDate(`${employee.startDate}T12:00:00Z`)}</dd>
            {employee.exitedOn ? (
              <>
                <dt>Last day</dt>
                <dd>{formatDate(`${employee.exitedOn}T12:00:00Z`)}</dd>
              </>
            ) : null}
            <dt>Direct reports</dt>
            <dd>{reports.length ? reports.map((r) => r.name).join(", ") : "None"}</dd>
          </dl>
          {can("employee/update") && employee.status !== "Exited" ? (
            <div className="button-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn small" onClick={onEdit}>
                Edit details
              </button>
              <button type="button" className="btn small danger" onClick={() => setExitDate(todayIso ?? "")}>
                Record exit
              </button>
            </div>
          ) : null}
          {exitDate !== null ? (
            <div className="notice warn" style={{ marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label htmlFor={`${titleId}-exit`} style={{ flex: 1, minWidth: 160 }}>
                Last working day for {employee.name}
              </label>
              <input id={`${titleId}-exit`} type="date" className="control" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
              <button type="button" className="btn small" onClick={() => setExitDate(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn small dark"
                disabled={!exitDate}
                onClick={() => {
                  act({ type: "employee/exit", employeeId: employee.id, date: exitDate });
                  toast(`Exit recorded for ${employee.name}.`);
                  setExitDate(null);
                }}
              >
                Confirm exit
              </button>
            </div>
          ) : null}
        </section>

        {isAdmin ? (
          <section className="drawer-section" aria-label="Pay">
            <h3>Pay · HR admins only</h3>
            <p style={{ margin: "0 0 10px", fontSize: 13 }}>
              Monthly gross: <strong>{typeof pay === "number" ? formatNaira(pay) : "Not set"}</strong>
            </p>
            {can("employee/setPay") && employee.status !== "Exited" ? (
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(payDraft.replace(/[,\s₦]/g, ""));
                  if (!(amount >= 0 && amount < 1e9)) {
                    toast("Enter a monthly amount in naira, e.g. 450000.");
                    return;
                  }
                  act({ type: "employee/setPay", employeeId: employee.id, monthlyGross: amount });
                  toast(`Pay updated for ${employee.name}.`);
                  setPayDraft("");
                }}
              >
                <label htmlFor={`${titleId}-pay`} className="sr-only">
                  New monthly gross pay
                </label>
                <input id={`${titleId}-pay`} className="control" inputMode="numeric" placeholder="New monthly gross, e.g. 500000" value={payDraft} onChange={(e) => setPayDraft(e.target.value)} />
                <button className="btn" disabled={!payDraft.trim()}>
                  Update
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        {employee.status === "Onboarding" || state.onboarding.some((t) => t.employeeId === employee.id) ? (
          <section className="drawer-section" aria-label="Onboarding">
            <h3>Onboarding</h3>
            <OnboardingChecklist employee={employee} mode="manage" />
          </section>
        ) : null}

        <section className="drawer-section" aria-label="Leave">
          <h3>Leave {year ?? ""}</h3>
          {balance ? (
            <div className="mini-stats">
              <div>
                <strong>{balance.remaining}</strong>
                <span>days left</span>
              </div>
              <div>
                <strong>{balance.taken}</strong>
                <span>taken</span>
              </div>
              <div>
                <strong>{balance.pending}</strong>
                <span>pending</span>
              </div>
              <div>
                <strong>{balance.allowance}</strong>
                <span>allowance</span>
              </div>
            </div>
          ) : null}
          {recentLeave.length ? (
            <ul className="timeline" style={{ marginTop: 12 }}>
              {recentLeave.map((l) => (
                <li key={l.id} style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{l.leaveType}</strong> · {l.days} day{l.days === 1 ? "" : "s"}
                    <span>
                      {formatDate(`${l.startDate}T12:00:00Z`)} – {formatDate(`${l.endDate}T12:00:00Z`)}
                    </span>
                  </div>
                  <Badge tone={l.status === "Approved" ? "ok" : l.status === "Pending" ? "warn" : "neutral"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="stat-foot" style={{ margin: "10px 0 0" }}>
              No leave recorded.
            </p>
          )}
        </section>

        <section className="drawer-section" aria-label="Performance" style={{ borderBottom: 0 }}>
          <h3>Latest review</h3>
          {review ? (
            <p style={{ margin: 0, fontSize: 13 }}>
              {review.cycle}: <strong>{review.status}</strong>
              {review.rating ? ` · ${review.rating}/5` : ""}
              {review.reviewerName ? ` · ${review.reviewerName}` : ""}
            </p>
          ) : (
            <p className="stat-foot" style={{ margin: 0 }}>
              No review yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function EmployeesView() {
  const { state, act, can, isAdmin } = usePeople();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<Department | "all">("all");
  const [status, setStatus] = useState<EmployeeStatus | "current">("current");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; id: string } | null>(null);

  const current = state.employees.filter((e) => e.status !== "Exited");
  const managers = useMemo(() => [...new Set(state.employees.filter((e) => e.status !== "Exited").map((e) => e.name))].sort(), [state.employees]);
  const q = query.trim().toLowerCase();
  const list = state.employees.filter((e) => {
    if (status === "current" ? e.status === "Exited" : e.status !== status) return false;
    if (dept !== "all" && e.department !== dept) return false;
    return !q || [e.name, e.email, e.jobTitle, e.location, e.managerName].some((v) => v.toLowerCase().includes(q));
  });
  const open = state.employees.find((e) => e.id === openId) ?? null;
  const editing = form?.mode === "edit" ? state.employees.find((e) => e.id === form.id) : undefined;

  function exportCsv() {
    const rows = list.map((e) => ({
      Name: e.name,
      Email: e.email,
      Phone: e.phone,
      Department: e.department,
      "Job title": e.jobTitle,
      Manager: e.managerName,
      Location: e.location,
      "Employment type": e.employmentType,
      Status: e.status,
      "Start date": e.startDate,
    }));
    downloadText(`maghr-employees-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    toast(`Exported ${pluralise(rows.length, "employee")}. Pay is not included.`);
  }

  return (
    <>
      <PageHeader
        eyebrow="YOUR PEOPLE, ONE PLACE"
        title="Employees"
        intro="Directory, reporting lines and essential details for everyone on the team."
        actions={
          <>
            <button type="button" className="btn" onClick={exportCsv} disabled={!list.length}>
              <Icon name="doc" size={15} /> Export CSV
            </button>
            {can("employee/add") ? (
              <button type="button" className="btn primary" onClick={() => setForm({ mode: "add" })}>
                <Icon name="plus" size={15} /> Add employee
              </button>
            ) : null}
          </>
        }
      />

      <div className="stats">
        <StatCard label="Headcount" icon="people" tone="orange" value={current.length} foot={`Across ${pluralise(new Set(current.map((e) => e.department)).size, "department")}`} />
        <StatCard label="Onboarding" icon="userPlus" tone="blue" value={current.filter((e) => e.status === "Onboarding").length} foot="Starting soon or in first weeks" />
        <StatCard label="Managers" icon="trend" tone="green" value={new Set(current.map((e) => e.managerName).filter(Boolean)).size} foot="People with direct reports" />
        <StatCard label="Exited" icon="clock" tone="purple" value={state.employees.filter((e) => e.status === "Exited").length} foot="Kept for records" />
      </div>

      <div className="toolbar">
        <div className="filters">
          <label className="sr-only" htmlFor="emp-search">
            Search employees
          </label>
          <input id="emp-search" className="control" type="search" placeholder="Search name, title, manager…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="sr-only" htmlFor="emp-dept">
            Department
          </label>
          <select id="emp-dept" className="control" value={dept} onChange={(e) => setDept(e.target.value as Department | "all")}>
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="emp-status">
            Status
          </label>
          <select id="emp-status" className="control" value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus | "current")}>
            <option value="current">Current staff</option>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <OnboardingPanel onOpen={setOpenId} />

      {state.employees.length === 0 ? (
        <Panel title="Directory">
          <EmptyState
            title="No employees yet"
            action={
              can("employee/add") ? (
                <button type="button" className="btn primary" onClick={() => setForm({ mode: "add" })}>
                  Add your first employee
                </button>
              ) : null
            }
          >
            Add people here, or convert hired candidates from Recruitment.
          </EmptyState>
        </Panel>
      ) : (
        <Panel title="Directory" subtitle={`${pluralise(list.length, "person", "people")} shown`}>
          {list.length === 0 ? (
            <EmptyState title="Nobody matches these filters" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <caption className="sr-only">Employees</caption>
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Department</th>
                    <th scope="col">Job title</th>
                    <th scope="col">Manager</th>
                    <th scope="col">Location</th>
                    <th scope="col">Status</th>
                    {isAdmin ? <th scope="col">Monthly gross</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} data-employee={e.id}>
                      <td>
                        <button type="button" className="row-btn" onClick={() => setOpenId(e.id)}>
                          <Avatar name={e.name} />
                          <span className="person-info">
                            <strong>{e.name}</strong>
                            <span>{e.email}</span>
                          </span>
                        </button>
                      </td>
                      <td>{e.department}</td>
                      <td>{e.jobTitle}</td>
                      <td>{e.managerName || "—"}</td>
                      <td>{e.location || "—"}</td>
                      <td>
                        <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                      </td>
                      {isAdmin ? <td>{typeof state.pay[e.id] === "number" ? formatNaira(state.pay[e.id]) : <span className="stat-foot">Not set</span>}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <p className="stat-foot" style={{ marginTop: 12 }}>
        Exports never include pay or bank details.
      </p>

      {open ? <EmployeeDrawer key={open.id} employee={open} onClose={() => setOpenId(null)} onEdit={() => setForm({ mode: "edit", id: open.id })} /> : null}

      {form ? (
        <Modal title={form.mode === "add" ? "Add an employee" : `Edit ${editing?.name ?? "employee"}`} onClose={() => setForm(null)} wide>
          {form.mode === "add" ? (
            <div style={{ marginBottom: 14 }}>
              <Notice>Use test details only until your data-protection checklist is complete.</Notice>
            </div>
          ) : null}
          <EmployeeForm
            initial={editing}
            showPay={isAdmin}
            managers={managers}
            onCancel={() => setForm(null)}
            onSubmit={(input, monthlyGross) => {
              if (form.mode === "add") {
                if (state.employees.some((e) => e.email.toLowerCase() === input.email.trim().toLowerCase())) {
                  toast("Someone with that email is already in the directory.");
                  return;
                }
                act({ type: "employee/add", input, monthlyGross });
                toast(`${input.name.trim()} added.`);
              } else if (editing) {
                act({ type: "employee/update", employeeId: editing.id, input });
                toast("Changes saved.");
              }
              setForm(null);
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
