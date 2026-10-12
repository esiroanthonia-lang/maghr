"use client";

import { useState, type FormEvent } from "react";
import type { NewCandidateInput } from "@/lib/recruitment";
import { ALL_STAGES, CANDIDATE_SOURCES, CV_STATUSES, type CandidateSource, type CvStatus, type Job, type Stage } from "@/lib/types";
import { Field } from "../ui/Field";

type Errors = Partial<Record<keyof NewCandidateInput, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateCandidate(input: NewCandidateInput): Errors {
  const e: Errors = {};
  if (input.name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = "Enter the candidate’s first and last name.";
  if (!EMAIL.test(input.email.trim())) e.email = "Enter a valid email address.";
  if (input.phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(input.phone.trim())) e.phone = "Use digits, spaces and an optional +.";
  return e;
}

export function CandidateForm({
  jobs,
  defaultJobId,
  onSubmit,
  onCancel,
}: {
  jobs: Job[];
  defaultJobId?: string | null;
  onSubmit: (input: NewCandidateInput) => void;
  onCancel: () => void;
}) {
  const selectable = jobs.filter((j) => j.status === "Open");
  const [input, setInput] = useState<NewCandidateInput>({
    name: "",
    email: "",
    phone: "",
    jobId: defaultJobId === undefined ? selectable[0]?.id ?? null : defaultJobId,
    stage: "Applied",
    cvStatus: "Received",
    source: "Added manually",
    note: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof NewCandidateInput>(k: K, v: NewCandidateInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateCandidate(input);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(input);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Full name" required error={errors.name} full>
          {(p) => <input {...p} data-autofocus value={input.name} onChange={(e) => set("name", e.target.value)} placeholder="First and last name" autoComplete="off" />}
        </Field>
        <Field label="Email address" required error={errors.email}>
          {(p) => <input {...p} type="email" value={input.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" autoComplete="off" />}
        </Field>
        <Field label="Phone number" error={errors.phone}>
          {(p) => <input {...p} type="tel" value={input.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234 …" autoComplete="off" />}
        </Field>
        <Field label="Role applied for" full hint="Choose “Talent pool” to keep a strong candidate on file without a current vacancy.">
          {(p) => (
            <select {...p} value={input.jobId ?? ""} onChange={(e) => set("jobId", e.target.value || null)}>
              {selectable.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.code})
                </option>
              ))}
              <option value="">Talent pool — no specific role</option>
            </select>
          )}
        </Field>
        <Field label="Starting stage">
          {(p) => (
            <select {...p} value={input.stage} onChange={(e) => set("stage", e.target.value as Stage)}>
              {ALL_STAGES.filter((s) => s !== "Hired" && s !== "Withdrawn" && s !== "Rejected").map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="CV status">
          {(p) => (
            <select {...p} value={input.cvStatus} onChange={(e) => set("cvStatus", e.target.value as CvStatus)}>
              {CV_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Source" full hint="Tracking where candidates come from shows which channels are worth paying for.">
          {(p) => (
            <select {...p} value={input.source} onChange={(e) => set("source", e.target.value as CandidateSource)}>
              {CANDIDATE_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Note (optional)" full hint="Use synthetic details only — this prototype must not hold real CVs or personal data.">
          {(p) => <textarea {...p} rows={3} value={input.note} onChange={(e) => set("note", e.target.value)} placeholder="How did you find this candidate?" />}
        </Field>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Add candidate
        </button>
      </div>
    </form>
  );
}
