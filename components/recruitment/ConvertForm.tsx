"use client";

import { useState, type FormEvent } from "react";
import type { ConvertInput } from "@/lib/recruitment";
import { DEPARTMENTS, type Candidate, type Department, type Job } from "@/lib/types";
import { Field } from "../ui/Field";
import { Notice } from "../ui/bits";

function twoWeeksFromToday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function ConvertForm({
  candidate,
  job,
  onSubmit,
  onCancel,
}: {
  candidate: Candidate;
  job: Job | null;
  onSubmit: (input: ConvertInput) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<ConvertInput>({
    department: job?.department ?? "People Operations",
    jobTitle: job?.title ?? "",
    location: job?.location ?? "",
    startDate: twoWeeksFromToday(),
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ConvertInput, string>>>({});
  const set = <K extends keyof ConvertInput>(k: K, v: ConvertInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!input.jobTitle.trim()) found.jobTitle = "Enter the job title.";
    if (!input.startDate) found.startDate = "Choose a start date.";
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(input);
  }

  return (
    <form onSubmit={submit} noValidate>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--ink-2)" }}>
        Create an employee record for <strong>{candidate.name}</strong> using the details from their application. Check each field before confirming.
      </p>
      <div className="form-grid">
        <Field label="Full name">{(p) => <input {...p} value={candidate.name} readOnly />}</Field>
        <Field label="Work email" hint="Uses the application email until IT issues a work address.">
          {(p) => <input {...p} value={candidate.email} readOnly />}
        </Field>
        <Field label="Job title" required error={errors.jobTitle}>
          {(p) => <input {...p} data-autofocus value={input.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />}
        </Field>
        <Field label="Department">
          {(p) => (
            <select {...p} value={input.department} onChange={(e) => set("department", e.target.value as Department)}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Work location">{(p) => <input {...p} value={input.location} onChange={(e) => set("location", e.target.value)} />}</Field>
        <Field label="Start date" required error={errors.startDate}>
          {(p) => <input {...p} type="date" value={input.startDate} onChange={(e) => set("startDate", e.target.value)} />}
        </Field>
      </div>
      <div style={{ marginTop: 16 }}>
        <Notice tone="warn">
          Demo only. No contract, bank, tax or pension details are collected here — those need secure storage and access controls in a later phase.
        </Notice>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Convert to employee
        </button>
      </div>
    </form>
  );
}
