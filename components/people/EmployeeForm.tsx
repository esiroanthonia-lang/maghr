"use client";

import { useState, type FormEvent } from "react";
import type { EmployeeInput } from "@/lib/people";
import { DEPARTMENTS, EMPLOYMENT_TYPES, type Department, type Employee, type EmploymentType } from "@/lib/types";
import { Field } from "../ui/Field";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EmployeeForm({
  initial,
  showPay,
  managers,
  onSubmit,
  onCancel,
}: {
  initial?: Employee;
  showPay: boolean;
  managers: string[];
  onSubmit: (input: EmployeeInput, monthlyGross: number | null) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<EmployeeInput>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    department: initial?.department ?? "Engineering",
    jobTitle: initial?.jobTitle ?? "",
    location: initial?.location ?? "",
    startDate: initial?.startDate ?? new Date().toISOString().slice(0, 10),
    managerName: initial?.managerName ?? "",
    employmentType: initial?.employmentType ?? "Full-time",
    status: initial?.status === "Onboarding" ? "Onboarding" : initial ? "Active" : "Onboarding",
  });
  const [pay, setPay] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (input.name.trim().split(/\s+/).length < 2) found.name = "Enter first and last name.";
    if (!EMAIL.test(input.email.trim())) found.email = "Enter a valid work email.";
    if (!input.jobTitle.trim()) found.jobTitle = "Enter a job title.";
    if (!input.startDate) found.startDate = "Choose a start date.";
    const amount = pay.trim() ? Number(pay.replace(/[,\s₦]/g, "")) : null;
    if (amount !== null && !(amount >= 0 && amount < 1e9)) found.pay = "Enter a monthly amount in naira, e.g. 450000.";
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(input, amount);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Full name" required error={errors.name} full>
          {(p) => <input {...p} data-autofocus value={input.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />}
        </Field>
        <Field label="Work email" required error={errors.email}>
          {(p) => <input {...p} type="email" value={input.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />}
        </Field>
        <Field label="Phone">
          {(p) => <input {...p} type="tel" value={input.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234 …" />}
        </Field>
        <Field label="Job title" required error={errors.jobTitle}>
          {(p) => <input {...p} value={input.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />}
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
        <Field label="Manager">
          {(p) => (
            <>
              <input {...p} list="manager-list" value={input.managerName} onChange={(e) => set("managerName", e.target.value)} placeholder="Type or choose" />
              <datalist id="manager-list">
                {managers.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Work location">
          {(p) => <input {...p} value={input.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Lagos · Hybrid" />}
        </Field>
        <Field label="Employment type">
          {(p) => (
            <select {...p} value={input.employmentType} onChange={(e) => set("employmentType", e.target.value as EmploymentType)}>
              {EMPLOYMENT_TYPES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Start date" required error={errors.startDate}>
          {(p) => <input {...p} type="date" value={input.startDate} onChange={(e) => set("startDate", e.target.value)} />}
        </Field>
        <Field label="Status">
          {(p) => (
            <select {...p} value={input.status} onChange={(e) => set("status", e.target.value as EmployeeInput["status"])}>
              <option>Onboarding</option>
              <option>Active</option>
            </select>
          )}
        </Field>
        {showPay && !initial ? (
          <Field label="Monthly gross pay (₦)" error={errors.pay} hint="Optional. Only HR admins can see pay." full>
            {(p) => <input {...p} inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value)} placeholder="e.g. 450000" />}
          </Field>
        ) : null}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          {initial ? "Save changes" : "Add employee"}
        </button>
      </div>
    </form>
  );
}
