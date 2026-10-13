"use client";

import { formatNaira } from "@/lib/people";
import type { PayrollLine } from "@/lib/types";
import { Badge } from "../ui/bits";

export type SlipFigures = Omit<PayrollLine, "id" | "runId" | "employeeId" | "employeeName">;

const kobo = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** A printable payslip. `estimate` marks figures worked out from rules nobody has confirmed yet. */
export function PayslipCard({
  company,
  period,
  name,
  detail,
  slip,
  estimate,
  status,
}: {
  company: string;
  period: string;
  name: string;
  detail: string;
  slip: SlipFigures;
  estimate: boolean;
  status?: string;
}) {
  const earnings: [string, number][] = [
    ["Basic", slip.basic],
    ["Housing", slip.housing],
    ["Transport", slip.transport],
    ["Other allowances", slip.other],
  ];
  const deductions: [string, number][] = [
    ["Pension (employee)", slip.pension],
    ...(slip.nhf > 0 ? ([["National Housing Fund", slip.nhf]] as [string, number][]) : []),
    ["PAYE tax", slip.paye],
  ];
  const totalDeductions = slip.pension + slip.nhf + slip.paye;
  return (
    <div className="payslip slip">
      <div className="payslip-head">
        <div>
          <strong>{company}</strong>
          <span>Payslip · {period}</span>
        </div>
        {estimate ? <Badge tone="warn">Estimate</Badge> : status ? <Badge tone={status === "Approved" ? "ok" : "neutral"}>{status}</Badge> : null}
      </div>
      <div className="slip-who">
        <strong>{name}</strong>
        <span>{detail}</span>
      </div>
      <div className="slip-cols">
        <table className="slip-table">
          <caption>Earnings</caption>
          <tbody>
            {earnings.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{kobo(v)}</td>
              </tr>
            ))}
            <tr className="slip-total">
              <th scope="row">Gross pay</th>
              <td>{kobo(slip.gross)}</td>
            </tr>
          </tbody>
        </table>
        <table className="slip-table">
          <caption>Deductions</caption>
          <tbody>
            {deductions.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{kobo(v)}</td>
              </tr>
            ))}
            <tr className="slip-total">
              <th scope="row">Total deductions</th>
              <td>{kobo(totalDeductions)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="slip-net">
        <span>Net pay</span>
        <strong>{kobo(slip.net)}</strong>
      </div>
      <p className="slip-notes">
        PAYE is worked out on annual taxable income of {formatNaira(slip.taxable)}
        {slip.rentRelief > 0 ? `, after rent relief of ${formatNaira(slip.rentRelief)}` : ""}, pension and NHF. Your employer also pays {kobo(slip.employerPension)}{" "}
        into your pension this month.
        {estimate ? " These are estimates until the company’s payroll rules are confirmed." : ""}
      </p>
    </div>
  );
}

/** Opens the browser's print dialog for just the payslip on screen (see @media print in globals.css). */
export function printPayslip() {
  document.body.classList.add("printing-slip");
  const done = () => {
    document.body.classList.remove("printing-slip");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
