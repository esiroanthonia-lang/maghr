"use client";

import Link from "next/link";
import { useDemoStore } from "@/lib/store";
import { Icon } from "../ui/Icon";

/** First-run guide for a new HR admin. Disappears once every step is done. Real workspaces only. */
export function SetupChecklist() {
  const { state, workspace } = useDemoStore();
  if (workspace.mode !== "live") return null;

  const staff = state.employees.filter((e) => e.status !== "Exited");
  const steps = [
    { key: "people", title: "Add your first employees", hint: "Start with a few people, or add everyone one by one.", href: "/employees", done: staff.length > 0 },
    { key: "pay", title: "Set each person's monthly pay", hint: "Open an employee's profile and enter their gross pay. Payslips need this.", href: "/employees", done: staff.some((e) => (state.pay[e.id] ?? 0) > 0) },
    { key: "rules", title: "Confirm your payroll rules", hint: "Have your payroll professional check the tax, pension and NHF rates.", href: "/settings", done: Boolean(state.payrollConfig.confirmedBy) },
    { key: "team", title: "Invite your team", hint: "Use each person's work email, so they see their own payslips.", href: "/settings", done: state.invitations.length > 0 },
    { key: "run", title: "Prepare your first payroll", hint: "Review the payslips, then submit for approval.", href: "/payroll", done: state.payrollRuns.length > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <section className="setup" aria-labelledby="setup-title">
      <div className="setup-head">
        <div>
          <h2 id="setup-title">Get Membra ready for your team</h2>
          <p>
            {doneCount} of {steps.length} done
          </p>
        </div>
        <div className="setup-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="Setup progress">
          <b style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="setup-steps">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? "done" : s === next ? "next" : ""}>
            <span className="setup-mark" aria-hidden="true">
              {s.done ? <Icon name="check" size={14} /> : null}
            </span>
            <div>
              <strong>{s.title}</strong>
              {!s.done ? <p>{s.hint}</p> : null}
            </div>
            {!s.done ? (
              <Link className={`btn ${s === next ? "primary" : ""}`} href={s.href}>
                {s === next ? "Start" : "Open"}
              </Link>
            ) : (
              <span className="setup-done">Done</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
