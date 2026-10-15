"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, pluralise } from "@/lib/format";
import { computePayslip } from "@/lib/paye";
import { activeEmployees, computeRunLines, formatNaira, payrollTotals, periodLabel, runTotals, toCsv } from "@/lib/people";
import type { PayrollLine, PayrollRun } from "@/lib/types";
import { Badge, EmptyState, Notice, PageHeader, Panel, StatCard } from "../ui/bits";
import { downloadText } from "../ui/download";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { PayslipCard, printPayslip, type SlipFigures } from "./Payslip";
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

const money = (n: number) => formatNaira(Math.round(n));

function RunDetail({ run, lines, onClose, onSlip }: { run: PayrollRun; lines: PayrollLine[]; onClose: () => void; onSlip: (l: PayrollLine) => void }) {
  const file = (kind: string) => `membra-${kind}-${run.period}.csv`;
  const sorted = [...lines].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  return (
    <Modal title={`${periodLabel(run.period)} payroll`} onClose={onClose} wide>
      <div className="run-meta">
        <Badge tone={tone(run.status)}>{run.status}</Badge>
        <span>
          Prepared by {run.preparedBy || "—"}
          {run.approvedBy ? ` · approved by ${run.approvedBy}${run.approvedAt ? `, ${formatDate(run.approvedAt)}` : ""}` : ""}
        </span>
      </div>
      {lines.length === 0 ? (
        <EmptyState title="No payslips yet">Payslips are created when the run is submitted for approval.</EmptyState>
      ) : (
        <>
          <div className="button-row" style={{ margin: "4px 0 12px", flexWrap: "wrap" }}>
            <button type="button" className="btn small" onClick={() => downloadText(file("bank-schedule"), toCsv(sorted.map((l) => ({ Employee: l.employeeName, "Net pay (NGN)": l.net }))))}>
              <Icon name="doc" size={14} /> Bank schedule
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() =>
                downloadText(
                  file("paye-schedule"),
                  toCsv(sorted.map((l) => ({ Employee: l.employeeName, "Gross (NGN)": l.gross, "Annual taxable (NGN)": l.taxable, "Rent relief (NGN, annual)": l.rentRelief, "PAYE this month (NGN)": l.paye }))),
                )
              }
            >
              <Icon name="doc" size={14} /> PAYE schedule
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() =>
                downloadText(
                  file("pension-schedule"),
                  toCsv(sorted.map((l) => ({ Employee: l.employeeName, "Employee (NGN)": l.pension, "Employer (NGN)": l.employerPension, "Total (NGN)": Math.round((l.pension + l.employerPension) * 100) / 100 }))),
                )
              }
            >
              <Icon name="doc" size={14} /> Pension schedule
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table num-table">
              <caption className="sr-only">Payslips in this run</caption>
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Gross</th>
                  <th scope="col">Pension</th>
                  <th scope="col">NHF</th>
                  <th scope="col">PAYE</th>
                  <th scope="col">Net</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <button type="button" className="link-btn" onClick={() => onSlip(l)}>
                        {l.employeeName}
                      </button>
                    </td>
                    <td>{money(l.gross)}</td>
                    <td>{money(l.pension)}</td>
                    <td>{money(l.nhf)}</td>
                    <td>{money(l.paye)}</td>
                    <td className="cell-strong">{money(l.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{money(run.grossTotal)}</td>
                  <td>{money(run.pensionTotal)}</td>
                  <td>{money(run.nhfTotal)}</td>
                  <td>{money(run.payeTotal)}</td>
                  <td className="cell-strong">{money(run.netTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="stat-foot" style={{ marginTop: 10 }}>
            Employer pension on top of gross: {money(run.employerPensionTotal)}. Remit PAYE to the state tax authority and pension to each person’s PFA by the statutory deadlines.
          </p>
        </>
      )}
    </Modal>
  );
}

export function PayrollView() {
  const { state, act, can, isAdmin, workspace, now } = usePeople();
  const toast = useToast();
  const [slip, setSlip] = useState<{ name: string; detail: string; period: string; figures: SlipFigures; status?: string } | null>(null);
  const [runOpen, setRunOpen] = useState<string | null>(null);
  const me = workspace.mode === "live" ? workspace.me.name : "HR Admin";

  if (!isAdmin) {
    return (
      <>
        <PageHeader eyebrow="PAY PEOPLE ACCURATELY" title="Payroll & payslips" intro="Payroll is visible to HR admins only." />
        <Panel title="Restricted">
          <EmptyState title="Only HR admins can see payroll">Your own payslips are in My space once each month’s payroll is approved.</EmptyState>
        </Panel>
      </>
    );
  }

  const cfg = state.payrollConfig;
  const confirmed = Boolean(cfg.confirmedBy);
  const { count } = payrollTotals(state);
  const preview = computeRunLines(state, "preview");
  const totals = runTotals(preview);
  const gross = preview.reduce((n, l) => n + l.gross, 0);
  const people = activeEmployees(state);
  const missing = people.filter((e) => !(state.pay[e.id] > 0));
  const runs = [...state.payrollRuns].sort((a, b) => b.period.localeCompare(a.period));
  const period = nextPeriod(state.payrollRuns, now);
  const openRun = runs.find((r) => r.id === runOpen);

  function showSlip(employeeId: string) {
    const e = state.employees.find((x) => x.id === employeeId)!;
    const p = computePayslip(state.pay[e.id] ?? 0, state.rent[e.id] ?? 0, cfg);
    setSlip({
      name: e.name,
      detail: `${e.jobTitle} · ${e.department}`,
      period: periodLabel(period),
      figures: {
        gross: p.monthlyGross,
        basic: p.basic,
        housing: p.housing,
        transport: p.transport,
        other: p.other,
        pension: p.pension,
        nhf: p.nhf,
        paye: p.paye,
        net: p.net,
        employerPension: p.employerPension,
        rentRelief: p.annualRentRelief,
        taxable: p.annualTaxable,
      },
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="PAY PEOPLE ACCURATELY"
        title="Payroll & payslips"
        intro="Work out PAYE, pension and NHF, get a second HR admin to approve, and give everyone a payslip."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadText(
                  `membra-pay-list-${period}.csv`,
                  toCsv(
                    people.map((e) => {
                      const l = preview.find((x) => x.employeeId === e.id);
                      return {
                        Employee: e.name,
                        Department: e.department,
                        "Gross (NGN)": l?.gross ?? null,
                        "Pension (NGN)": l?.pension ?? null,
                        "NHF (NGN)": l?.nhf ?? null,
                        "PAYE (NGN)": l?.paye ?? null,
                        "Net (NGN)": l?.net ?? null,
                      };
                    }),
                  ),
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
                title={count === 0 ? "Set at least one person's pay on their profile first" : undefined}
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
        {confirmed ? (
          <Notice>
            Payroll rules confirmed by <strong>{cfg.confirmedBy}</strong>
            {cfg.confirmedAt ? ` on ${formatDate(cfg.confirmedAt)}` : ""}. Membra works out pay and payslips; money still goes out through your bank.
          </Notice>
        ) : (
          <Notice tone="warn">
            <strong>Estimates.</strong> PAYE uses the Nigeria Tax Act 2025 bands (from 1 January 2026), pension at {cfg.pensionEmployeeRate}% + {cfg.pensionEmployerRate}% and NHF at{" "}
            {cfg.nhfEnabled ? `${cfg.nhfRate}%` : "off"}. Ask a qualified payroll professional to check them in <strong>Settings → Payroll rules</strong> and confirm before you pay anyone from these figures.
          </Notice>
        )}
      </div>

      <div className="stats">
        <StatCard label="Monthly gross" icon="naira" tone="orange" value={<span style={{ fontSize: 24 }}>{money(gross)}</span>} foot={`${pluralise(count, "person", "people")} with pay set${missing.length ? `, ${missing.length} missing` : ""}`} />
        <StatCard label="PAYE this month" icon="report" tone="blue" value={<span style={{ fontSize: 24 }}>{money(totals.payeTotal)}</span>} foot="To the state tax authority" />
        <StatCard label="Pension" icon="people" tone="green" value={<span style={{ fontSize: 24 }}>{money(totals.pensionTotal + totals.employerPensionTotal)}</span>} foot={`${money(totals.employerPensionTotal)} from the company`} />
        <StatCard label="Net pay" icon="check" tone="purple" value={<span style={{ fontSize: 24 }}>{money(totals.netTotal)}</span>} foot="What lands in people’s accounts" />
      </div>

      <Panel title="Payroll runs" subtitle="Draft → submitted (payslips locked) → approved by a different HR admin.">
        {runs.length === 0 ? (
          <EmptyState title="No payroll runs yet">Set pay for your team, then prepare this month’s run.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">People</th>
                  <th scope="col">Gross</th>
                  <th scope="col">PAYE</th>
                  <th scope="col">Net</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} data-run={r.id}>
                    <td className="cell-strong">
                      <button type="button" className="link-btn" onClick={() => setRunOpen(r.id)} aria-label={`Open ${periodLabel(r.period)} payroll`}>
                        {periodLabel(r.period)}
                      </button>
                    </td>
                    <td>{r.employeeCount}</td>
                    <td>{money(r.grossTotal)}</td>
                    <td>{r.status === "Draft" ? <span className="stat-foot">On submit</span> : money(r.payeTotal)}</td>
                    <td>{r.status === "Draft" ? <span className="stat-foot">On submit</span> : money(r.netTotal)}</td>
                    <td>
                      <Badge tone={tone(r.status)}>{r.status}</Badge>
                      {r.status === "Approved" && r.approvedBy ? <span className="stat-foot"> · {r.approvedBy}</span> : null}
                    </td>
                    <td>
                      {r.status === "Draft" ? (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => {
                            act({ type: "payroll/submit", runId: r.id });
                            toast(`${periodLabel(r.period)} submitted. Payslips and totals are now locked.`);
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
                                toast(`${periodLabel(r.period)} approved. Staff can now see their payslips.`);
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
                        <button type="button" className="btn small" onClick={() => setRunOpen(r.id)}>
                          Payslips
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="This month’s pay" subtitle="Live from current pay and payroll rules. Click a name for their payslip.">
        <div className="table-wrap">
          <table className="data-table num-table">
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Gross</th>
                <th scope="col">Pension</th>
                <th scope="col">NHF</th>
                <th scope="col">PAYE</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {people.map((e) => {
                const l = preview.find((x) => x.employeeId === e.id);
                return (
                  <tr key={e.id} data-pay={e.name}>
                    <td>
                      <button type="button" className="link-btn" style={{ color: "var(--ink)" }} onClick={() => (l ? showSlip(e.id) : toast("Set this person’s pay on their profile first."))}>
                        {e.name}
                      </button>
                      <span className="stat-foot" style={{ display: "block" }}>
                        {e.department}
                        {state.rent[e.id] ? ` · rent ${money(state.rent[e.id])}/yr` : ""}
                      </span>
                    </td>
                    {l ? (
                      <>
                        <td>{money(l.gross)}</td>
                        <td>{money(l.pension)}</td>
                        <td>{money(l.nhf)}</td>
                        <td>{money(l.paye)}</td>
                        <td className="cell-strong">{money(l.net)}</td>
                      </>
                    ) : (
                      <td colSpan={5}>
                        <Badge tone="warn">Pay not set</Badge>{" "}
                        <Link className="link-btn" href={`/employees/${e.id}`}>
                          Set pay
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {openRun ? (
        <RunDetail
          run={openRun}
          lines={state.payrollLines.filter((l) => l.runId === openRun.id)}
          onClose={() => setRunOpen(null)}
          onSlip={(l) => {
            const e = state.employees.find((x) => x.id === l.employeeId);
            setRunOpen(null);
            setSlip({ name: l.employeeName, detail: e ? `${e.jobTitle} · ${e.department}` : "", period: periodLabel(openRun.period), figures: l, status: openRun.status });
          }}
        />
      ) : null}

      {slip ? (
        <Modal title={`Payslip · ${slip.name}`} onClose={() => setSlip(null)}>
          <PayslipCard
            company={state.settings.companyName}
            period={slip.period}
            name={slip.name}
            detail={slip.detail}
            slip={slip.figures}
            estimate={!confirmed && slip.status !== "Approved"}
            status={slip.status}
          />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setSlip(null)}>
              Close
            </button>
            <button type="button" className="btn dark" onClick={printPayslip}>
              <Icon name="doc" size={15} /> Print or save as PDF
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
