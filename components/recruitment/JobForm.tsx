"use client";

import { useState, type FormEvent } from "react";
import type { NewJobInput } from "@/lib/recruitment";
import { parseRequirementLines } from "@/lib/matching";
import { DEPARTMENTS, EMPLOYMENT_TYPES, type Department, type EmploymentType, type JobStatus } from "@/lib/types";
import { ChannelPicker } from "./ChannelPicker";
import { Field } from "../ui/Field";
import { Notice } from "../ui/bits";

type Errors = Partial<Record<keyof NewJobInput, string>>;

export function validateJob(input: NewJobInput): Errors {
  const e: Errors = {};
  if (input.title.trim().length < 3) e.title = "Enter a job title (at least 3 characters).";
  if (!input.location.trim()) e.location = "Enter a location, e.g. Lagos / Hybrid.";
  if (!input.owner.trim()) e.owner = "Who owns this vacancy?";
  if (input.status === "Open" && input.description.trim().length < 20)
    e.description = "Add a short description (20+ characters) before opening the role.";
  return e;
}

export function JobForm({ onSubmit, onCancel }: { onSubmit: (input: NewJobInput) => void; onCancel: () => void }) {
  const [input, setInput] = useState<NewJobInput>({
    title: "",
    department: "Engineering",
    location: "",
    employmentType: "Full-time",
    owner: "",
    description: "",
    status: "Open",
    requirements: [],
    channels: ["MyJobMag", "Careers page"],
  });
  const [reqText, setReqText] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof NewJobInput>(k: K, v: NewJobInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const full = { ...input, requirements: parseRequirementLines(reqText) };
    const found = validateJob(full);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(full);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Job title" required error={errors.title} full>
          {(p) => <input {...p} data-autofocus value={input.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. People Operations Specialist" />}
        </Field>
        <Field label="Department" required>
          {(p) => (
            <select {...p} value={input.department} onChange={(e) => set("department", e.target.value as Department)}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Employment type" required>
          {(p) => (
            <select {...p} value={input.employmentType} onChange={(e) => set("employmentType", e.target.value as EmploymentType)}>
              {EMPLOYMENT_TYPES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Location" required error={errors.location}>
          {(p) => <input {...p} value={input.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Lagos / Hybrid" />}
        </Field>
        <Field label="Hiring owner" required error={errors.owner}>
          {(p) => <input {...p} value={input.owner} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. Grace Nwosu" />}
        </Field>
        <Field label="Job description" required={input.status === "Open"} error={errors.description} full>
          {(p) => (
            <textarea {...p} rows={4} value={input.description} onChange={(e) => set("description", e.target.value)} placeholder="Responsibilities, requirements and what success looks like" />
          )}
        </Field>
        <Field
          label="Requirements"
          full
          hint="One per line, e.g. “3+ years of React”, “TypeScript”, “Based in or near Lagos”. MagHR shows reviewers which ones each CV mentions. It never scores or rejects anyone."
        >
          {(p) => <textarea {...p} rows={4} value={reqText} onChange={(e) => setReqText(e.target.value)} placeholder={"3+ years of frontend development\nReact\nTypeScript"} />}
        </Field>
        <Field label="Status" full hint="Drafts stay internal. Open roles start accepting candidates in this demo.">
          {(p) => (
            <select {...p} value={input.status} onChange={(e) => set("status", e.target.value as JobStatus)}>
              <option value="Open">Open</option>
              <option value="Draft">Draft</option>
            </select>
          )}
        </Field>
      </div>
      {input.status === "Open" ? (
        <fieldset className="fieldset">
          <legend>Publish to</legend>
          <ChannelPicker value={input.channels} onChange={(channels) => set("channels", channels)} />
        </fieldset>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <Notice>Demo: nothing is actually posted. Live publishing to MyJobMag needs an approved integration.</Notice>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          {input.status === "Draft" ? "Save draft" : input.channels.length ? "Create & publish" : "Create job"}
        </button>
      </div>
    </form>
  );
}
