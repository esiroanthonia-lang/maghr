"use client";

import { useState } from "react";
import { formatDate, pluralise } from "@/lib/format";
import { activeEmployees, formatNaira, payrollTotals, periodLabel, toCsv } from "@/lib/people";
import type { PayrollRun } from "@/lib/types";
import { Badge, EmptyState, Notice, PageHeader, Panel, StatCard } from "../ui/bits";
import { downloadText } from "../ui/download";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { usePeople } from "./usePeople";

const DEMO_APPROVER = "Kunle Akande (demo second admin)";
const tone = (s: PayrollRun["status"]) => (s === "Approved" ? "ok" : s === "Pending approval" ? "warn" : "neutral");

function nextPeriod(runs: PayrollRun[], now: Date | null): string {
  const base = now ?? new Date();
  const current = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
  if (!runs.some((r) => r.period === current)) return current;
  const latest = [...runs].sort((a, b) => b.period.localeCompare(a.period))[0].period;
  const [y, m] = latest.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function PayrollView() {
  const { state, act, can, isAdmin, workspace, now } = usePeople();
  const toast = useToast();
  const [slipFor, setSlipFor] = useState<string | null>(null);
  const me = workspace.mode === "live" ? workspace.me.name : "HR Admin";

  if (!isAdmin) {
    return (
      <>
        <PageHeader eyebrow="PAY PEOPLE ACCURATELY" title="Payroll & payslips" intro="Payroll is visible to HR admins only." />
        <Panel title="Restricted">
          <EmptyState title="Only HR admins can see payroll">Ask an HR admin if you need your payslip.</EmptyState>
        </Panel>
      </>
    );
  }

  const { count, total } = payrollTotals(state);
  const people = activeEmployees(state);
  const missing = people.filter((e) => !(state.pay[e.id] > 0));
  const runs = [...state.payrollRuns].sort((a, b) => b.period.localeCompare(a.period));
  const lastApproved = runs.find((r) => r.status === "Approved");
  const period = nextPeriod(state.payrollRuns, now);
  const slipEmployee = state.employees.find((e) => e.id === slipFor);

  return (
    <>
      <PageHeader
        eyebrow="PAY PEOPLE ACCURATELY"
        title="Payroll & payslips"
        intro="Prepare monthly payroll, get a second HR admin to approve it, and keep a clear record."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadText(
                  `maghr-payroll-${period}.csv`,
                  toCsv(people.map((e) => ({ Employee: e.name, Department: e.department, "Job title": e.jobTitle, "Monthly gross (NGN)": state.pay[e.id] ?? null }))),
                )
              }
            >
              <Icon name="doc" size={15} /> Export pay list
            </button>
            {can("payroll/create") ? (
              <button
                type="button"
                className="btn primary"
                disabled={count === 0}
                onClick={() => {
                  act({ type: "payroll/create", period });
                  toast(`Payroll for ${periodLabel(period)} prepared as a draft.`);
                }}
              >
                <Icon name="plus" size={15} /> Prepare {periodLabel(period)}
              </button>
            ) : null}
          </>
        }
      />

      <div style={{ marginBottom: 18 }}>
        <Notice tone="warn">
          <strong>Preview only.</strong> MagHR totals gross pay and records approvals. It does not yet calculate PAYE, pension, NHF or other deductions, and it doesn’t move money. Those need statutory rules validated by a qualified payroll professional and a licensed payment provider.
        </Notice>
      </div>

      <div className="stats">
        <StatCard label="Monthly gross" icon="naira" tone="orange" value={<span style={{ fontSize: 24 }}>{formatNaira(total)}</span>} foot={`${pluralise(count, "person", "people")} with pay set`} />
        <StatCard label="Missing pay" icon="bell" tone="blue" value={missing.length} foot={missing.length ? "Set pay on their profile" : "Everyone has pay set"} />
        <StatCard label="Awaiting approval" icon="clock" tone="green" value={runs.filter((r) => r.status === "Pending approval").length} foot="Needs a second HR admin" />
        <StatCard label="Last approved" icon="check" tone="purple" value={<span style={{ fontSize: 22 }}>{lastApproved ? periodLabel(lastApproved.period) : "—"}</span>} foot={lastApproved ? `by ${lastApproved.approvedBy}` : "No runs yet"} />
      </div>

      <Panel title="Payroll runs" subtitle="Draft → submitted → approved by a different HR admin. Approved runs are locked.">
        {runs.length === 0 ? (
          <EmptyState title="No payroll runs yet">Set pay for your team, then prepare this month’s run.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">People</th>
                  <th scope="col">Gross total</th>
                  <th scope="col">Prepared by</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} data-run={r.id}>
                    <td className="cell-strong">{periodLabel(r.period)}</td>
                    <td>{r.employeeCount}</td>
                    <td>{formatNaira(r.grossTotal)}</td>
                    <td>{r.preparedBy || "—"}</td>
                    <td>
                      <Badge tone={tone(r.status)}>{r.status}</Badge>
                      {r.status === "Approved" && r.approvedBy ? (
                        <span className="stat-foot">
                          {" "}
                          · {r.approvedBy}
                          {r.approvedAt ? `, ${formatDate(r.approvedAt)}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {r.status === "Draft" ? (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => {
                            act({ type: "payroll/submit", runId: r.id });
                            toast(`${periodLabel(r.period)} submitted for approval. Totals are now locked.`);
                          }}
                        >
                          Submit for approval
                        </button>
                      ) : r.status === "Pending approval" ? (
                        <div className="button-row">
                          {workspace.mode === "demo" ? (
                            <button
                              type="button"
                              className="btn small dark"
                              onClick={() => {
                                act({ type: "payroll/approve", runId: r.id, by: DEMO_APPROVER });
                                toast(`${periodLabel(r.period)} approved by a second admin (demo).`);
                              }}
                            >
                              Approve as second admin (demo)
                            </button>
                          ) : r.preparedBy === me ? (
                            <span className="stat-foot">Waiting for another HR admin</span>
                          ) : (
                            <button
                              type="button"
                              className="btn small dark"
                              onClick={() => {
                                act({ type: "payroll/approve", runId: r.id });
                                toast(`${periodLabel(r.period)} approved.`);
                              }}
                            >
                              Approve
                            </button>
                          )}
                          <button type="button" className="btn small" onClick={() => act({ type: "payroll/reopen", runId: r.id })}>
                            Return to draft
                          </button>
                        </div>
                      ) : (
                        <span className="stat-foot">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Pay list" subtitle="Monthly gross per person. Click a name for a payslip preview.">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Department</th>
                <th scope="col">Monthly gross</th>
              </tr>
            </thead>
            <tbody>
              {people.map((e) => (
                <tr key={e.id}>
                  <td>
                    <button type="button" className="link-btn" style={{ fontSize: 12, color: "var(--ink)" }} onClick={() => setSlipFor(e.id)}>
                      {e.name}
                    </button>
                  </td>
                  <td>{e.department}</td>
                  <td>{state.pay[e.id] > 0 ? formatNaira(state.pay[e.id]) : <Badge tone="warn">Not set</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {slipEmployee ? (
        <Modal title={`Payslip preview · ${slipEmployee.name}`} onClose={() => setSlipFor(null)}>
          <div className="payslip">
            <div className="payslip-head">
              <div>
                <strong>{state.settings.companyName}</strong>
                <span>{periodLabel(period)}</span>
              </div>
              <Badge tone="warn">Preview</Badge>
            </div>
            <dl className="kv">
              <dt>Employee</dt>
              <dd>{slipEmployee.name}</dd>
              <dt>Job title</dt>
              <dd>{slipEmployee.jobTitle}</dd>
              <dt>Department</dt>
              <dd>{slipEmployee.department}</dd>
            </dl>
            <table className="data-table" style={{ marginTop: 14 }}>
              <tbody>
                <tr>
                  <td>Gross pay</td>
                  <td style={{ textAlign: "right" }} className="cell-strong">
                    {state.pay[slipEmployee.id] > 0 ? formatNaira(state.pay[slipEmployee.id]) : "Not set"}
                  </td>
                </tr>
                <tr>
                  <td>PAYE, pension, NHF and other deductions</td>
                  <td style={{ textAlign: "right" }}>Not calculated yet</td>
                </tr>
                <tr>
                  <td className="cell-strong">Net pay</td>
                  <td style={{ textAlign: "right" }}>Available once deductions are validated</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setSlipFor(null)}>
              Close
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
