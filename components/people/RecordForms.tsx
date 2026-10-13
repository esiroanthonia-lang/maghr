"use client";

import { useId, useState, type ReactNode } from "react";
import {
  BANK_SUGGESTIONS,
  checkBank,
  checkJob,
  checkPersonal,
  DEGREE_CLASSES,
  emptyContact,
  GENDERS,
  MARITAL_STATUSES,
  NIGERIAN_STATES,
  NYSC_STATUSES,
  PFA_SUGGESTIONS,
  QUALIFICATIONS,
  type BankDetails,
  type Contact,
  type Education,
  type Guarantor,
  type JobDetails,
  type PersonalDetails,
} from "@/lib/employee-record";
import { Icon } from "../ui/Icon";

// Small helpers so each form stays readable.

function Text({ label, value, onChange, type = "text", error, hint, full, list, max = 200, placeholder, inputMode }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  hint?: string;
  full?: boolean;
  list?: string;
  max?: number;
  placeholder?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  const id = useId();
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} maxLength={max} list={list} placeholder={placeholder} inputMode={inputMode} aria-invalid={error ? true : undefined} onChange={(e) => onChange(e.target.value)} />
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

function Choice({ label, value, onChange, options, full }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[]; full?: boolean }) {
  const id = useId();
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not given</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function Group({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <fieldset className="rec-group">
      <legend>{title}</legend>
      {action ? <div className="rec-group-action">{action}</div> : null}
      <div className="form-grid">{children}</div>
    </fieldset>
  );
}

function Actions({ onCancel, saveLabel = "Save" }: { onCancel: () => void; saveLabel?: string }) {
  return (
    <div className="modal-actions">
      <button type="button" className="btn" onClick={onCancel}>
        Cancel
      </button>
      <button className="btn primary">{saveLabel}</button>
    </div>
  );
}

function ContactFields({ prefix, c, onChange, error }: { prefix: string; c: Contact; onChange: (c: Contact) => void; error?: string }) {
  return (
    <>
      <Text label={`${prefix} name`} value={c.name} onChange={(v) => onChange({ ...c, name: v })} max={120} error={error} />
      <Text label={`${prefix} relationship`} value={c.relationship} onChange={(v) => onChange({ ...c, relationship: v })} max={60} placeholder="e.g. Sister" />
      <Text label={`${prefix} phone`} value={c.phone} onChange={(v) => onChange({ ...c, phone: v })} type="tel" inputMode="tel" max={30} placeholder="+234" />
      <Text label={`${prefix} address`} value={c.address} onChange={(v) => onChange({ ...c, address: v })} max={300} />
    </>
  );
}

// ---------- Personal ----------

export function PersonalForm({ initial, today, onSave, onCancel, self }: { initial: PersonalDetails; today: string | null; onSave: (p: PersonalDetails) => void; onCancel: () => void; self?: boolean }) {
  const [p, setP] = useState<PersonalDetails>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof PersonalDetails>(k: K, v: PersonalDetails[K]) => setP({ ...p, [k]: v });
  const setEdu = (i: number, x: Education) => set("education", p.education.map((e, j) => (j === i ? x : e)));
  const setEmergency = (i: number, c: Contact) => set("emergencyContacts", p.emergencyContacts.map((e, j) => (j === i ? c : e)));

  return (
    <form
      className="rec-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const errs = checkPersonal(p, today ?? undefined);
        setErrors(errs);
        if (Object.keys(errs).length === 0) onSave(p);
      }}
    >
      {self ? <p className="stat-foot" style={{ margin: "0 0 12px" }}>Keep these up to date so HR can reach your people in an emergency. Only HR admins and you can see them.</p> : null}
      <Group title="About you">
        <Text label="Preferred name" value={p.preferredName} onChange={(v) => set("preferredName", v)} max={60} />
        <Text label="Date of birth" type="date" value={p.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} error={errors.dateOfBirth} />
        <Choice label="Gender" value={p.gender} onChange={(v) => set("gender", v)} options={GENDERS} />
        <Choice label="Marital status" value={p.maritalStatus} onChange={(v) => set("maritalStatus", v)} options={MARITAL_STATUSES} />
        <Text label="Nationality" value={p.nationality} onChange={(v) => set("nationality", v)} max={60} />
        <Choice label="State of origin" value={p.stateOfOrigin} onChange={(v) => set("stateOfOrigin", v)} options={NIGERIAN_STATES} />
        <Text label="LGA" value={p.lga} onChange={(v) => set("lga", v)} max={80} hint="Local government area" />
      </Group>
      <Group title="Contact and address">
        <Text label="Personal email" type="email" inputMode="email" value={p.personalEmail} onChange={(v) => set("personalEmail", v)} error={errors.personalEmail} />
        <Text label="Other phone" type="tel" inputMode="tel" value={p.altPhone} onChange={(v) => set("altPhone", v)} error={errors.altPhone} placeholder="+234" />
        <Text label="Home address" value={p.address} onChange={(v) => set("address", v)} max={300} full />
        <Text label="City" value={p.city} onChange={(v) => set("city", v)} max={80} />
        <Choice label="State of residence" value={p.stateOfResidence} onChange={(v) => set("stateOfResidence", v)} options={NIGERIAN_STATES} />
      </Group>
      <Group title="Next of kin">
        <ContactFields prefix="Next of kin" c={p.nextOfKin} onChange={(c) => set("nextOfKin", c)} error={errors.nextOfKin} />
      </Group>
      <Group
        title="Emergency contacts"
        action={
          p.emergencyContacts.length < 3 ? (
            <button type="button" className="btn small" onClick={() => set("emergencyContacts", [...p.emergencyContacts, emptyContact()])}>
              <Icon name="plus" size={13} /> Add contact
            </button>
          ) : null
        }
      >
        {p.emergencyContacts.length === 0 ? <p className="stat-foot full" style={{ margin: 0 }}>None added.</p> : null}
        {p.emergencyContacts.map((c, i) => (
          <div key={i} className="rec-repeat full">
            <div className="form-grid">
              <ContactFields prefix={`Contact ${i + 1}`} c={c} onChange={(x) => setEmergency(i, x)} error={errors[`emergency${i}`]} />
            </div>
            <button type="button" className="link-btn" onClick={() => set("emergencyContacts", p.emergencyContacts.filter((_, j) => j !== i))}>
              Remove contact {i + 1}
            </button>
          </div>
        ))}
      </Group>
      <Group
        title="Education"
        action={
          p.education.length < 6 ? (
            <button type="button" className="btn small" onClick={() => set("education", [...p.education, { institution: "", qualification: "", course: "", grade: "", year: "" }])}>
              <Icon name="plus" size={13} /> Add qualification
            </button>
          ) : null
        }
      >
        {p.education.length === 0 ? <p className="stat-foot full" style={{ margin: 0 }}>None added.</p> : null}
        {p.education.map((x, i) => (
          <div key={i} className="rec-repeat full">
            <div className="form-grid">
              <Text label={`School ${i + 1}`} value={x.institution} onChange={(v) => setEdu(i, { ...x, institution: v })} max={160} error={errors[`education${i}`]} />
              <Choice label={`Qualification ${i + 1}`} value={x.qualification} onChange={(v) => setEdu(i, { ...x, qualification: v })} options={QUALIFICATIONS} />
              <Text label={`Course ${i + 1}`} value={x.course} onChange={(v) => setEdu(i, { ...x, course: v })} max={120} />
              <Choice label={`Grade ${i + 1}`} value={x.grade} onChange={(v) => setEdu(i, { ...x, grade: v })} options={DEGREE_CLASSES} />
              <Text label={`Year ${i + 1}`} value={x.year} onChange={(v) => setEdu(i, { ...x, year: v.replace(/\D/g, "") })} max={4} inputMode="numeric" />
            </div>
            <button type="button" className="link-btn" onClick={() => set("education", p.education.filter((_, j) => j !== i))}>
              Remove qualification {i + 1}
            </button>
          </div>
        ))}
      </Group>
      <Group title="NYSC">
        <Choice label="NYSC status" value={p.nyscStatus} onChange={(v) => set("nyscStatus", v)} options={NYSC_STATUSES} />
        <Text label="NYSC year" value={p.nyscYear} onChange={(v) => set("nyscYear", v.replace(/\D/g, ""))} max={4} inputMode="numeric" error={errors.nyscYear} />
      </Group>
      {Object.keys(errors).length ? (
        <p className="auth-error" role="alert">
          Some details need fixing. Check the highlighted fields.
        </p>
      ) : null}
      <Actions onCancel={onCancel} saveLabel="Save personal details" />
    </form>
  );
}

// ---------- Job & contract (HR only) ----------

export function JobDetailsForm({ initial, onSave, onCancel }: { initial: JobDetails; onSave: (j: JobDetails) => void; onCancel: () => void }) {
  const [j, setJ] = useState<JobDetails>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof JobDetails>(k: K, v: JobDetails[K]) => setJ({ ...j, [k]: v });
  const setG = (i: number, g: Guarantor) => set("guarantors", j.guarantors.map((x, k) => (k === i ? g : x)));
  return (
    <form
      className="rec-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const errs = checkJob(j);
        setErrors(errs);
        if (Object.keys(errs).length === 0) onSave(j);
      }}
    >
      <Group title="Contract">
        <Text label="Staff ID" value={j.staffId} onChange={(v) => set("staffId", v)} max={30} placeholder="e.g. MJM-0042" />
        <Text label="Grade or level" value={j.grade} onChange={(v) => set("grade", v)} max={40} placeholder="e.g. Senior Associate" />
        <Text label="Probation ends" type="date" value={j.probationEnd} onChange={(v) => set("probationEnd", v)} error={errors.probationEnd} />
        <Text label="Confirmed on" type="date" value={j.confirmedOn} onChange={(v) => set("confirmedOn", v)} error={errors.confirmedOn} />
        <Text label="Contract ends" type="date" value={j.contractEnd} onChange={(v) => set("contractEnd", v)} error={errors.contractEnd} hint="Leave empty for permanent staff" />
      </Group>
      <Group
        title="Guarantors"
        action={
          j.guarantors.length < 3 ? (
            <button type="button" className="btn small" onClick={() => set("guarantors", [...j.guarantors, { name: "", phone: "", occupation: "", address: "", verified: false }])}>
              <Icon name="plus" size={13} /> Add guarantor
            </button>
          ) : null
        }
      >
        {j.guarantors.length === 0 ? <p className="stat-foot full" style={{ margin: 0 }}>None added.</p> : null}
        {j.guarantors.map((g, i) => (
          <div key={i} className="rec-repeat full">
            <div className="form-grid">
              <Text label={`Guarantor ${i + 1} name`} value={g.name} onChange={(v) => setG(i, { ...g, name: v })} max={120} error={errors[`guarantor${i}`]} />
              <Text label={`Guarantor ${i + 1} phone`} type="tel" inputMode="tel" value={g.phone} onChange={(v) => setG(i, { ...g, phone: v })} max={30} />
              <Text label={`Guarantor ${i + 1} occupation`} value={g.occupation} onChange={(v) => setG(i, { ...g, occupation: v })} max={120} />
              <Text label={`Guarantor ${i + 1} address`} value={g.address} onChange={(v) => setG(i, { ...g, address: v })} max={300} />
            </div>
            <div className="rec-repeat-foot">
              <label className="inline-check">
                <input type="checkbox" checked={g.verified} onChange={(e) => setG(i, { ...g, verified: e.target.checked })} /> Verified by HR
              </label>
              <button type="button" className="link-btn" onClick={() => set("guarantors", j.guarantors.filter((_, k) => k !== i))}>
                Remove guarantor {i + 1}
              </button>
            </div>
          </div>
        ))}
      </Group>
      <Actions onCancel={onCancel} saveLabel="Save job details" />
    </form>
  );
}

// ---------- Bank & statutory (HR only) ----------

export function BankForm({ initial, onSave, onCancel }: { initial: BankDetails; onSave: (b: BankDetails) => void; onCancel: () => void }) {
  const [b, setB] = useState<BankDetails>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof BankDetails>(k: K, v: BankDetails[K]) => setB({ ...b, [k]: v });
  return (
    <form
      className="rec-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const errs = checkBank(b);
        setErrors(errs);
        if (Object.keys(errs).length === 0) onSave(b);
      }}
    >
      <datalist id="bank-list">
        {BANK_SUGGESTIONS.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <datalist id="pfa-list">
        {PFA_SUGGESTIONS.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <Group title="Salary account">
        <Text label="Bank" value={b.bankName} onChange={(v) => set("bankName", v)} list="bank-list" max={80} error={errors.bankName} />
        <Text label="Account number" value={b.accountNumber} onChange={(v) => set("accountNumber", v.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" max={10} error={errors.accountNumber} hint="10-digit NUBAN" />
        <Text label="Account name" value={b.accountName} onChange={(v) => set("accountName", v)} max={120} full hint="As it appears on the bank’s records" />
      </Group>
      <Group title="Pension, tax and health">
        <Text label="Pension Fund Administrator" value={b.pfa} onChange={(v) => set("pfa", v)} list="pfa-list" max={80} />
        <Text label="RSA PIN" value={b.rsaPin} onChange={(v) => set("rsaPin", v.toUpperCase().replace(/\s/g, ""))} max={15} placeholder="PEN…" error={errors.rsaPin} />
        <Text label="Tax ID (TIN)" value={b.tin} onChange={(v) => set("tin", v.replace(/[^0-9-]/g, ""))} max={20} error={errors.tin} />
        <Text label="NHF number" value={b.nhfNumber} onChange={(v) => set("nhfNumber", v)} max={30} />
        <Text label="HMO" value={b.hmo} onChange={(v) => set("hmo", v)} max={80} hint="Health insurance provider" />
      </Group>
      <Actions onCancel={onCancel} saveLabel="Save bank and statutory details" />
    </form>
  );
}
