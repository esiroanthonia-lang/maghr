"use client";

import { useActionState, type ReactNode } from "react";
import type { ApplyState } from "@/app/actions/careers";

const INITIAL: ApplyState = { status: "idle", message: "", errors: {} };

export function ApplyForm({ action, company, jobTitle }: { action: (prev: ApplyState, form: FormData) => Promise<ApplyState>; company: string; jobTitle: string }) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const err = (k: string) => state.errors[k];

  if (state.status === "sent") {
    return (
      <div className="apply-done" role="status">
        <strong>Application sent</strong>
        <p>
          Thank you. {company} has your application for {jobTitle}. If you’re a good fit, someone from the team will contact you by email or phone.
        </p>
        {state.demo ? <p className="apply-demo">This is the demo workspace, so nothing was saved.</p> : null}
      </div>
    );
  }

  const field = (name: string, label: string, input: ReactNode, hint?: string) => (
    <div className={`apply-field ${err(name) ? "has-error" : ""}`}>
      <label htmlFor={`ap-${name}`}>{label}</label>
      {input}
      {err(name) ? (
        <span className="apply-err" id={`ap-${name}-err`}>
          {err(name)}
        </span>
      ) : hint ? (
        <span className="apply-hint">{hint}</span>
      ) : null}
    </div>
  );
  const aria = (name: string) => ({ "aria-invalid": err(name) ? true : undefined, "aria-describedby": err(name) ? `ap-${name}-err` : undefined });

  return (
    <form action={formAction} className="apply-form" noValidate>
      {field("name", "Full name", <input id="ap-name" name="name" autoComplete="name" required maxLength={120} {...aria("name")} />)}
      {field("email", "Email", <input id="ap-email" name="email" type="email" autoComplete="email" required maxLength={200} {...aria("email")} />)}
      {field("phone", "Phone (optional)", <input id="ap-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="+234" {...aria("phone")} />)}
      <div className="apply-row">
        {field("location", "City", <input id="ap-location" name="location" autoComplete="address-level2" maxLength={80} placeholder="e.g. Lagos" {...aria("location")} />)}
        {field("years", "Years of experience", <input id="ap-years" name="years" inputMode="numeric" defaultValue="0" maxLength={2} {...aria("years")} />)}
      </div>
      {field(
        "note",
        "Why this role? (optional)",
        <textarea id="ap-note" name="note" rows={4} maxLength={1500} {...aria("note")} />,
        "A few lines is plenty. Please don’t include ID numbers or bank details.",
      )}
      <div className="apply-hp" aria-hidden="true">
        <label htmlFor="ap-website">Leave this empty</label>
        <input id="ap-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className={`apply-consent ${err("consent") ? "has-error" : ""}`}>
        <input id="ap-consent" name="consent" type="checkbox" {...aria("consent")} />
        <label htmlFor="ap-consent">
          I agree that {company} may store and use these details to consider me for this and similar roles, in line with the Nigeria Data Protection Act. I can ask for them to be deleted at any time.
        </label>
        {err("consent") ? (
          <span className="apply-err" id="ap-consent-err">
            {err("consent")}
          </span>
        ) : null}
      </div>
      {state.status === "error" && state.message ? (
        <p className="apply-alert" role="alert">
          {state.message}
        </p>
      ) : null}
      <button className="btn primary apply-submit" disabled={pending}>
        {pending ? "Sending…" : "Send application"}
      </button>
      <p className="apply-hint">You don’t need an account. If we need your CV, we’ll ask by email.</p>
    </form>
  );
}
