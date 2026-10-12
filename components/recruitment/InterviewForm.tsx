"use client";

import { useState, type FormEvent } from "react";
import type { InterviewInput } from "@/lib/recruitment";
import { INTERVIEW_MODES, type InterviewMode } from "@/lib/types";
import { Field } from "../ui/Field";
import { Notice } from "../ui/bits";

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInputValue(d);
}

export function InterviewForm({
  candidateName,
  canMoveStage,
  onSubmit,
  onCancel,
}: {
  candidateName: string;
  canMoveStage: boolean;
  onSubmit: (input: InterviewInput) => void;
  onCancel: () => void;
}) {
  const [when, setWhen] = useState(defaultSlot);
  const [mode, setMode] = useState<InterviewMode>("Video call");
  const [interviewers, setInterviewers] = useState("");
  const [location, setLocation] = useState("");
  const [move, setMove] = useState(true);
  const [errors, setErrors] = useState<{ when?: string; interviewers?: string }>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    const date = new Date(when);
    if (!when || Number.isNaN(date.getTime())) found.when = "Choose a date and time.";
    else if (date.getTime() < Date.now() - 5 * 60 * 1000) found.when = "Choose a time in the future.";
    if (!interviewers.trim()) found.interviewers = "Add at least one interviewer.";
    setErrors(found);
    if (Object.keys(found).length) return;
    onSubmit({
      scheduledFor: date.toISOString(),
      mode,
      interviewers: interviewers.trim(),
      location: location.trim() || (mode === "Video call" ? "Link to be shared" : mode === "Phone" ? "Phone call" : "Office"),
      moveToInterviewStage: canMoveStage && move,
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Date and time" required error={errors.when}>
          {(p) => <input {...p} data-autofocus type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}
        </Field>
        <Field label="Format">
          {(p) => (
            <select {...p} value={mode} onChange={(e) => setMode(e.target.value as InterviewMode)}>
              {INTERVIEW_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Interviewers" required error={errors.interviewers} full>
          {(p) => <input {...p} value={interviewers} onChange={(e) => setInterviewers(e.target.value)} placeholder="e.g. Grace Nwosu, Daniel Adebayo" />}
        </Field>
        <Field label={mode === "Video call" ? "Meeting link or note" : mode === "Phone" ? "Who calls whom" : "Venue"} full>
          {(p) => <input {...p} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={mode === "In person" ? "e.g. Lagos office, 3rd floor" : "Optional"} />}
        </Field>
        {canMoveStage ? (
          <label className="check field full">
            <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} />
            Also move {candidateName} to the Interview stage
          </label>
        ) : null}
      </div>
      <div style={{ marginTop: 16 }}>
        <Notice>Calendar invites and emails are not sent in this prototype.</Notice>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Schedule interview
        </button>
      </div>
    </form>
  );
}
