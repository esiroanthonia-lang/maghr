"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { completeness, emptyRecord, missingItems } from "@/lib/employee-record";
import { pluralise } from "@/lib/format";
import { formatNaira, toCsv } from "@/lib/people";
import { DEPARTMENTS, EMPLOYEE_STATUSES, type Department, type EmployeeStatus } from "@/lib/types";
import { Avatar, Badge, EmptyState, Notice, PageHeader, Panel, StatCard } from "../ui/bits";
import { downloadText } from "../ui/download";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { EmployeeForm } from "./EmployeeForm";
import { OnboardingPanel } from "./Onboarding";
import { usePeople } from "./usePeople";

const statusTone = (s: EmployeeStatus) => (s === "Active" ? "ok" : s === "Onboarding" ? "info" : "neutral");

export function EmployeesView() {
  const { state, act, can, isAdmin } = usePeople();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<Department | "all">("all");
  const [status, setStatus] = useState<EmployeeStatus | "current">("current");
  const router = useRouter();
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; id: string } | null>(null);

  const current = state.employees.filter((e) => e.status !== "Exited");
  const managers = useMemo(() => [...new Set(state.employees.filter((e) => e.status !== "Exited").map((e) => e.name))].sort(), [state.employees]);
  const q = query.trim().toLowerCase();
  const list = state.employees.filter((e) => {
    if (status === "current" ? e.status === "Exited" : e.status !== status) return false;
    if (dept !== "all" && e.department !== dept) return false;
    return !q || [e.name, e.email, e.jobTitle, e.location, e.managerName].some((v) => v.toLowerCase().includes(q));
  });
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

      <OnboardingPanel onOpen={(id) => router.push(`/employees/${id}`)} />

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
                    {isAdmin ? <th scope="col">Profile</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} data-employee={e.id}>
                      <td>
                        <Link href={`/employees/${e.id}`} className="row-btn">
                          <Avatar name={e.name} />
                          <span className="person-info">
                            <strong>{e.name}</strong>
                            <span>{e.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td>{e.department}</td>
                      <td>{e.jobTitle}</td>
                      <td>{e.managerName || "—"}</td>
                      <td>{e.location || "—"}</td>
                      <td>
                        <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                      </td>
                      {isAdmin ? <td>{typeof state.pay[e.id] === "number" ? formatNaira(state.pay[e.id]) : <span className="stat-foot">Not set</span>}</td> : null}
                      {isAdmin ? (
                        <td>
                          <span className="complete-chip" title={`Missing: ${missingItems(state.records[e.id] ?? emptyRecord(), state.bank[e.id] ?? null, { includeBank: true }).join(", ") || "nothing"}`}>
                            {completeness(state.records[e.id] ?? emptyRecord(), state.bank[e.id] ?? null, { includeBank: true })}%
                          </span>
                        </td>
                      ) : null}
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
