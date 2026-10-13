"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { hoursWorked, lagosDate, lagosTime, lastDays } from "@/lib/attendance";
import { ageOn, completeness, emptyRecord, EMPTY_BANK, mask, missingItems, type BankDetails } from "@/lib/employee-record";
import { formatDate, pluralise } from "@/lib/format";
import { computePayslip } from "@/lib/paye";
import { formatNaira, leaveBalance, onboardingProgress, periodLabel } from "@/lib/people";
import type { EmployeeStatus } from "@/lib/types";
import { Avatar, Badge, EmptyState, Notice, Panel } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { EmployeeForm } from "./EmployeeForm";
import { OnboardingChecklist } from "./Onboarding";
import { BankForm, JobDetailsForm, PersonalForm } from "./RecordForms";
import { usePeople } from "./usePeople";
import { myEmployeeEmail } from "@/lib/workspace";
import { EmployeeDocuments } from "./EmployeeDocuments";
import { EmployeeLetters } from "./EmployeeLetters";

const statusTone = (s: EmployeeStatus) => (s === "Active" ? "ok" : s === "Onboarding" ? "info" : "neutral");
const d = (iso: string) => (iso ? formatDate(`${iso}T12:00:00Z`) : "—");
const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

type Tab = "overview" | "personal" | "job" | "pay" | "time" | "performance" | "documents" | "letters";
const EXIT_STEPS = [
  ["handover", "Complete handover and transfer open work"],
  ["property", "Collect company equipment and property"],
  ["access", "Close or transfer system access"],
  ["pay", "Review final pay, leave and benefits"],
  ["interview", "Complete exit interview"],
  ["documents", "File resignation and exit documents"],
] as const;

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, onEdit, editLabel, children }: { title: string; onEdit?: () => void; editLabel?: string; children: ReactNode }) {
  return (
    <Panel
      title={title}
      action={
        onEdit ? (
          <button type="button" className="btn small" onClick={onEdit} aria-label={editLabel ?? `Edit ${title.toLowerCase()}`}>
            <Icon name="doc" size={13} /> Edit
          </button>
        ) : null
      }
    >
      <div className="panel-body">{children}</div>
    </Panel>
  );
}

function tenure(start: string, today: string | null): string {
  if (!today) return "—";
  const months = (Number(today.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(today.slice(5, 7)) - Number(start.slice(5, 7)));
  if (start > today) return "Starts " + d(start);
  if (months < 1) return "Less than a month";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? pluralise(y, "year") : "", m ? pluralise(m, "month") : ""].filter(Boolean).join(", ");
}

export function EmployeeProfile({ employeeId }: { employeeId: string }) {
  const { state, act, can, isAdmin, todayIso, year, now, workspace, role } = usePeople();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<null | "basics" | "personal" | "job" | "bank">(null);
  const [showBank, setShowBank] = useState(false);
  const [payDraft, setPayDraft] = useState("");
  const [rentDraft, setRentDraft] = useState("");
  const [exitDate, setExitDate] = useState<string | null>(null);
  const [exitReasonDraft, setExitReasonDraft] = useState("Resignation");
  const [exitChecklistDraft, setExitChecklistDraft] = useState<string[]>([]);
  const [probationAction, setProbationAction] = useState<"extend" | "confirm" | null>(null);
  const [probationDraft, setProbationDraft] = useState("");

  const e = state.employees.find((x) => x.id === employeeId);
  if (!e) {
    return (
      <Panel title="Employee not found">
        <EmptyState title="This person isn’t in your directory" action={<Link className="btn" href="/employees">Back to Employees</Link>}>
          They may have been removed, or you may not have access to their record.
        </EmptyState>
      </Panel>
    );
  }

  const myEmail = myEmployeeEmail(workspace, role) ?? "";
  const isSelf = e.email.toLowerCase() === myEmail;
  const hasRecord = Boolean(state.records[e.id]) || isAdmin;
  const rec = state.records[e.id] ?? emptyRecord();
  const bank: BankDetails | null = state.bank[e.id] ?? null;
  const canSeeBank = isAdmin || (isSelf && Boolean(bank));
  const pct = completeness(rec, bank, { includeBank: isAdmin });
  const missing = missingItems(rec, bank, { includeBank: isAdmin });
  const manager = state.employees.find((x) => x.name === e.managerName);
  const reports = state.employees.filter((x) => x.managerName === e.name && x.status !== "Exited");
  const balance = year ? leaveBalance(state, e.id, year) : null;
  const leave = state.leave.filter((l) => l.employeeId === e.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const reviews = [...state.reviews].filter((r) => r.employeeId === e.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const onb = onboardingProgress(state, e.id);
  const today = now ? lagosDate(now.toISOString()) : null;
  const week = today ? lastDays(today, 14).filter((x) => ![0, 6].includes(new Date(`${x}T00:00:00Z`).getUTCDay())) : [];
  const att = week.map((day) => ({ day, r: state.attendance.find((a) => a.employeeId === e.id && a.date === day) }));
  const pay = state.pay[e.id];
  const slip = typeof pay === "number" && pay > 0 ? computePayslip(pay, state.rent[e.id] ?? 0, state.payrollConfig) : null;
  const age = todayIso && rec.personal.dateOfBirth ? ageOn(rec.personal.dateOfBirth, todayIso) : null;
  const managers = [...new Set(state.employees.filter((x) => x.status !== "Exited" && x.id !== e.id).map((x) => x.name))].sort();
  const editPersonal = isAdmin || isSelf;

  const tabs: [Tab, string][] = [
    ["overview", "Overview"],
    ...(hasRecord ? ([["personal", "Personal"]] as [Tab, string][]) : []),
    ["job", "Job & contract"],
    ...(isAdmin || isSelf ? ([["pay", "Pay & bank"]] as [Tab, string][]) : []),
    ["time", "Leave & attendance"],
    ["performance", "Performance"],
    ...(isAdmin ? ([ ["documents", "Documents"], ["letters", "Letters"] ] as [Tab, string][]) : []),
  ];

  const p = rec.personal;
  const j = rec.job;
  const firstEmergency = p.emergencyContacts.find((c) => c.name);

  return (
    <>
      <nav className="crumbs-back" aria-label="Breadcrumb">
        <Link href="/employees">Employees</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{e.name}</span>
      </nav>

      <section className="profile-head" aria-labelledby="profile-name">
        <Avatar name={e.name} large />
        <div className="profile-id">
          <h1 id="profile-name">
            {e.name}
            {p.preferredName ? <span className="profile-pref"> “{p.preferredName}”</span> : null}
          </h1>
          <p>
            {e.jobTitle} · {e.department}
            {j.grade ? ` · ${j.grade}` : ""}
          </p>
          <div className="profile-badges">
            <Badge tone={statusTone(e.status)}>{e.status}</Badge>
            <Badge tone="neutral">{e.employmentType}</Badge>
            {j.staffId ? <Badge tone="neutral">{j.staffId}</Badge> : null}
          </div>
        </div>
        <dl className="profile-quick">
          <div>
            <dt>Manager</dt>
            <dd>{manager ? <Link href={`/employees/${manager.id}`}>{manager.name}</Link> : dash(e.managerName)}</dd>
          </div>
          <div>
            <dt>With us</dt>
            <dd>{tenure(e.startDate, todayIso)}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{dash(e.location)}</dd>
          </div>
        </dl>
        <div className="profile-actions">
          {can("employee/update") && e.status !== "Exited" ? (
            <>
              <button type="button" className="btn small" onClick={() => setEditing("basics")}>
                Edit basics
              </button>
              <button type="button" className="btn small danger" onClick={() => { setExitDate(todayIso ?? ""); setExitReasonDraft("Resignation"); setExitChecklistDraft([]); }}>
                Record exit
              </button>
            </>
          ) : null}
          {can("employee/update") && e.status === "Exited" ? <button type="button" className="btn small" onClick={() => { setExitDate(e.exitedOn ?? todayIso ?? ""); setExitReasonDraft(e.exitReason || "Resignation"); setExitChecklistDraft(e.exitChecklist); }}>Update exit checklist</button> : null}
          <button type="button" className="btn small" onClick={() => window.print()}>
            Print profile
          </button>
        </div>
      </section>

      {exitDate !== null ? (
        <div className="notice warn employee-exit-workflow" style={{ margin: "0 0 16px" }}>
          <strong>{e.status === "Exited" ? `Exit checklist · ${e.name}` : `Record exit · ${e.name}`}</strong>
          <div className="employee-exit-fields">
            <label className="field"><span className="label">Last working day</span><input id="exit-date" type="date" className="control" value={exitDate} onChange={(ev) => setExitDate(ev.target.value)} /></label>
            <label className="field"><span className="label">Reason</span><select className="control" value={exitReasonDraft} onChange={(ev) => setExitReasonDraft(ev.target.value)}><option>Resignation</option><option>Termination</option><option>Contract ended</option><option>Retirement</option><option>Other</option></select></label>
          </div>
          <p className="stat-foot">Complete each item as it is handled. You can save progress and return to this checklist later.</p>
          <div className="employee-exit-checklist">{EXIT_STEPS.map(([id, label]) => <label key={id}><input type="checkbox" checked={exitChecklistDraft.includes(id)} onChange={(ev) => setExitChecklistDraft((current) => ev.target.checked ? [...current, id] : current.filter((item) => item !== id))} />{label}</label>)}</div>
          <div className="employee-document-actions">
            <button type="button" className="btn small" onClick={() => setExitDate(null)}>Cancel</button>
            <button type="button" className="btn small dark" disabled={!exitDate} onClick={() => {
              act({ type: "employee/exit", employeeId: e.id, date: exitDate, reason: exitReasonDraft, checklist: exitChecklistDraft });
              toast(e.status === "Exited" ? "Exit checklist saved." : `Exit recorded for ${e.name}.`);
              setExitDate(null);
            }}>{e.status === "Exited" ? "Save checklist" : "Record exit"}</button>
          </div>
        </div>
      ) : null}

      {hasRecord && (isAdmin || isSelf) ? (
        <div className="profile-complete" aria-label={`Profile ${pct}% complete`}>
          <div className="profile-complete-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <span>
            <strong>{pct}% complete</strong>
            {missing.length ? ` · Missing: ${missing.join(", ")}` : " · Everything’s in"}
          </span>
        </div>
      ) : null}

      <div className="tabs" role="tablist" aria-label="Profile sections">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="profile-grid">
          <Section title="Contact">
            <Facts
              rows={[
                ["Work email", <a key="m" href={`mailto:${e.email}`}>{e.email}</a>],
                ["Work phone", dash(e.phone)],
                ...(hasRecord
                  ? ([
                      ["Personal email", dash(p.personalEmail)],
                      ["Other phone", dash(p.altPhone)],
                      ["Home address", p.address ? `${p.address}${p.city ? `, ${p.city}` : ""}${p.stateOfResidence ? `, ${p.stateOfResidence}` : ""}` : "—"],
                    ] as [string, ReactNode][])
                  : []),
              ]}
            />
          </Section>
          <Section title="Role">
            <Facts
              rows={[
                ["Department", e.department],
                ["Job title", e.jobTitle],
                ["Started", d(e.startDate)],
                ["Contract", e.employmentType],
                ...(hasRecord ? ([["Probation ends", d(j.probationEnd)], ["Confirmed", j.confirmedOn ? d(j.confirmedOn) : "Not yet"]] as [string, ReactNode][]) : []),
                ["Direct reports", reports.length ? reports.map((r, i) => <span key={r.id}>{i ? ", " : ""}<Link href={`/employees/${r.id}`}>{r.name}</Link></span>) : "None"],
              ]}
            />
          </Section>
          {hasRecord ? (
            <Section title="In an emergency">
              <Facts
                rows={[
                  ["Next of kin", p.nextOfKin.name ? `${p.nextOfKin.name}${p.nextOfKin.relationship ? ` (${p.nextOfKin.relationship})` : ""}` : "—"],
                  ["Next of kin phone", p.nextOfKin.phone ? <a key="t" href={`tel:${p.nextOfKin.phone.replace(/\s/g, "")}`}>{p.nextOfKin.phone}</a> : "—"],
                  ["Emergency contact", firstEmergency ? `${firstEmergency.name}${firstEmergency.relationship ? ` (${firstEmergency.relationship})` : ""}` : "—"],
                  ["Emergency phone", firstEmergency?.phone ? <a key="e" href={`tel:${firstEmergency.phone.replace(/\s/g, "")}`}>{firstEmergency.phone}</a> : "—"],
                ]}
              />
            </Section>
          ) : null}
          <Section title="At a glance">
            <div className="mini-stats">
              <div>
                <strong>{balance ? balance.remaining : "—"}</strong>
                <span>leave days left</span>
              </div>
              <div>
                <strong>{att.filter((x) => x.r).length}</strong>
                <span>days in, last 2 weeks</span>
              </div>
              <div>
                <strong>{reviews[0]?.rating ? `${reviews[0].rating}/5` : "—"}</strong>
                <span>{reviews[0] ? reviews[0].cycle : "no review yet"}</span>
              </div>
              <div>
                <strong>{onb.total ? `${onb.done}/${onb.total}` : "—"}</strong>
                <span>onboarding steps</span>
              </div>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "personal" && hasRecord ? (
        <div className="profile-grid">
          <Section title="About" onEdit={editPersonal ? () => setEditing("personal") : undefined} editLabel="Edit personal details">
            <Facts
              rows={[
                ["Date of birth", p.dateOfBirth ? `${d(p.dateOfBirth)}${age !== null ? ` (${age})` : ""}` : "—"],
                ["Gender", dash(p.gender)],
                ["Marital status", dash(p.maritalStatus)],
                ["Nationality", dash(p.nationality)],
                ["State of origin", p.stateOfOrigin ? `${p.stateOfOrigin}${p.lga ? ` · ${p.lga}` : ""}` : "—"],
                ["NYSC", p.nyscStatus ? `${p.nyscStatus}${p.nyscYear ? `, ${p.nyscYear}` : ""}` : "—"],
              ]}
            />
          </Section>
          <Section title="Next of kin and emergency" onEdit={editPersonal ? () => setEditing("personal") : undefined} editLabel="Edit next of kin and emergency contacts">
            {[{ label: "Next of kin", c: p.nextOfKin }, ...p.emergencyContacts.map((c, i) => ({ label: `Emergency contact ${i + 1}`, c }))].map(({ label, c }) => (
              <div key={label} className="contact-card">
                <span className="contact-label">{label}</span>
                {c.name ? (
                  <>
                    <strong>
                      {c.name}
                      {c.relationship ? <span className="stat-foot"> · {c.relationship}</span> : null}
                    </strong>
                    <span>{[c.phone, c.address].filter(Boolean).join(" · ") || "No phone or address"}</span>
                  </>
                ) : (
                  <span className="stat-foot">Not added</span>
                )}
              </div>
            ))}
          </Section>
          <Section title="Education" onEdit={editPersonal ? () => setEditing("personal") : undefined} editLabel="Edit education">
            {p.education.filter((x) => x.institution).length === 0 ? (
              <p className="stat-foot" style={{ margin: 0 }}>
                No qualifications added.
              </p>
            ) : (
              <ul className="timeline">
                {p.education
                  .filter((x) => x.institution)
                  .map((x, i) => (
                    <li key={i}>
                      <div>
                        <strong>
                          {[x.qualification, x.course].filter(Boolean).join(" ") || "Qualification"}
                          {x.grade && x.grade !== "Not applicable" ? `, ${x.grade}` : ""}
                        </strong>
                        <span>
                          {x.institution}
                          {x.year ? ` · ${x.year}` : ""}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}

      {tab === "job" ? (
        <div className="profile-grid">
          <Section title="Contract" onEdit={can("employee/updateJob") ? () => setEditing("job") : undefined} editLabel="Edit job and contract details">
            <Facts
              rows={[
                ["Staff ID", hasRecord ? dash(j.staffId) : "—"],
                ["Grade or level", hasRecord ? dash(j.grade) : "—"],
                ["Department", e.department],
                ["Job title", e.jobTitle],
                ["Employment type", e.employmentType],
                ["Start date", d(e.startDate)],
                ...(hasRecord ? ([["Probation ends", d(j.probationEnd)], ["Confirmed on", d(j.confirmedOn)], ["Contract ends", j.contractEnd ? d(j.contractEnd) : "Permanent"]] as [string, ReactNode][]) : []),
                ...(e.exitedOn ? ([["Last day", d(e.exitedOn)]] as [string, ReactNode][]) : []),
              ]}
            />
          </Section>
          {hasRecord ? (
            <Section title="Guarantors" onEdit={can("employee/updateJob") ? () => setEditing("job") : undefined} editLabel="Edit guarantors">
              {j.guarantors.length === 0 ? (
                <p className="stat-foot" style={{ margin: 0 }}>
                  No guarantors on file.
                </p>
              ) : (
                j.guarantors.map((g, i) => (
                  <div key={i} className="contact-card">
                    <span className="contact-label">Guarantor {i + 1}</span>
                    <strong>
                      {g.name} {g.verified ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}
                    </strong>
                    <span>{[g.occupation, g.phone, g.address].filter(Boolean).join(" · ")}</span>
                  </div>
                ))
              )}
            </Section>
          ) : null}
          {isAdmin && hasRecord && e.status !== "Exited" && j.probationEnd && !j.confirmedOn ? (
            <Section title="Probation and confirmation">
              <p className="stat-foot" style={{ margin: "0 0 12px" }}>Probation ends {d(j.probationEnd)}. Confirm employment or set a revised probation end date.</p>
              <div className="employee-document-actions">
                <button type="button" className="btn small primary" onClick={() => setProbationAction(probationAction === "confirm" ? null : "confirm")}>Confirm employment</button>
                <button type="button" className="btn small" onClick={() => { setProbationDraft(""); setProbationAction(probationAction === "extend" ? null : "extend"); }}>Extend probation</button>
              </div>
              {probationAction === "confirm" ? <div className="notice info" style={{ marginTop: 12, alignItems: "center", flexWrap: "wrap" }}><span>Confirm {e.name} effective {todayIso ? d(todayIso) : "today"}?</span><button type="button" className="btn small" onClick={() => setProbationAction(null)}>Cancel</button><button type="button" className="btn small dark" disabled={!todayIso} onClick={() => { act({ type: "employee/updateJob", employeeId: e.id, job: { ...j, confirmedOn: todayIso! } }); toast(`${e.name} confirmed. You can now prepare a confirmation letter.`); setProbationAction(null); }}>Confirm</button></div> : null}
              {probationAction === "extend" ? <form className="employee-probation-form" onSubmit={(event) => { event.preventDefault(); if (!probationDraft || probationDraft <= j.probationEnd) return toast("Choose a new date after the current probation end date."); act({ type: "employee/updateJob", employeeId: e.id, job: { ...j, probationEnd: probationDraft } }); toast(`Probation extended to ${d(probationDraft)}.`); setProbationAction(null); }}><label className="field"><span className="label">New probation end date</span><input className="control" type="date" min={j.probationEnd} value={probationDraft} onChange={(event) => setProbationDraft(event.target.value)} required /></label><button className="btn small primary" disabled={!probationDraft}>Save extension</button><button type="button" className="btn small" onClick={() => setProbationAction(null)}>Cancel</button></form> : null}
            </Section>
          ) : null}
          {e.status === "Onboarding" || onb.total ? (
            <Section title="Onboarding">
              <OnboardingChecklist employee={e} mode={isSelf && !isAdmin ? "self" : "manage"} />
            </Section>
          ) : null}
        </div>
      ) : null}

      {tab === "documents" && isAdmin ? <EmployeeDocuments employeeId={e.id} /> : null}
      {tab === "letters" && isAdmin ? <EmployeeLetters employee={e} confirmedOn={j.confirmedOn} /> : null}

      {tab === "pay" && (isAdmin || isSelf) ? (
        <div className="profile-grid">
          <Section title="Pay">
            <Facts
              rows={[
                ["Monthly gross", typeof pay === "number" ? formatNaira(pay) : "Not set"],
                ["Annual rent declared", state.rent[e.id] ? formatNaira(state.rent[e.id]) : "None"],
                ...(slip
                  ? ([
                      ["PAYE (monthly)", formatNaira(Math.round(slip.paye))],
                      ["Pension (monthly)", formatNaira(Math.round(slip.pension))],
                      ["Net (monthly)", <strong key="n">{formatNaira(Math.round(slip.net))}</strong>],
                    ] as [string, ReactNode][])
                  : []),
              ]}
            />
            {isAdmin && can("employee/setPay") && e.status !== "Exited" ? (
              <div className="pay-forms">
                <form
                  className="inline-form"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    const amount = Number(payDraft.replace(/[,\s₦]/g, ""));
                    if (!(amount >= 0 && amount < 1e9)) return toast("Enter a monthly amount in naira, e.g. 450000.");
                    act({ type: "employee/setPay", employeeId: e.id, monthlyGross: amount });
                    toast(`Pay updated for ${e.name}.`);
                    setPayDraft("");
                  }}
                >
                  <label htmlFor="p-pay" className="sr-only">
                    New monthly gross pay
                  </label>
                  <input id="p-pay" className="control" inputMode="numeric" placeholder="New monthly gross, e.g. 500000" value={payDraft} onChange={(ev) => setPayDraft(ev.target.value)} />
                  <button className="btn" disabled={!payDraft.trim()}>
                    Update pay
                  </button>
                </form>
                <form
                  className="inline-form"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    const amount = Number(rentDraft.replace(/[,\s₦]/g, ""));
                    if (!(amount >= 0 && amount < 1e10)) return toast("Enter the yearly rent in naira, e.g. 1500000. Use 0 for none.");
                    act({ type: "employee/setRent", employeeId: e.id, annualRent: amount });
                    toast(`Rent updated for ${e.name}. Keep the receipt or tenancy agreement on file.`);
                    setRentDraft("");
                  }}
                >
                  <label htmlFor="p-rent" className="sr-only">
                    Annual rent paid
                  </label>
                  <input id="p-rent" className="control" inputMode="numeric" placeholder="Annual rent paid, e.g. 1500000" value={rentDraft} onChange={(ev) => setRentDraft(ev.target.value)} />
                  <button className="btn" disabled={!rentDraft.trim()}>
                    Save rent
                  </button>
                </form>
              </div>
            ) : null}
          </Section>
          <Section title="Bank, pension and tax" onEdit={can("employee/updateBank") ? () => setEditing("bank") : undefined} editLabel="Edit bank and statutory details">
            {canSeeBank && bank ? (
              <>
                <Facts
                  rows={[
                    ["Bank", dash(bank.bankName)],
                    ["Account number", showBank ? dash(bank.accountNumber) : dash(mask(bank.accountNumber))],
                    ["Account name", dash(bank.accountName)],
                    ["Pension (PFA)", dash(bank.pfa)],
                    ["RSA PIN", showBank ? dash(bank.rsaPin) : dash(mask(bank.rsaPin))],
                    ["Tax ID (TIN)", showBank ? dash(bank.tin) : dash(mask(bank.tin))],
                    ["NHF number", showBank ? dash(bank.nhfNumber) : dash(mask(bank.nhfNumber))],
                    ["HMO", dash(bank.hmo)],
                  ]}
                />
                <button type="button" className="link-btn" onClick={() => setShowBank(!showBank)} aria-pressed={showBank}>
                  {showBank ? "Hide numbers" : "Show full numbers"}
                </button>
              </>
            ) : (
              <p className="stat-foot" style={{ margin: 0 }}>
                {isAdmin ? "No bank or statutory details yet." : "HR hasn’t added your bank details yet."}
              </p>
            )}
            <p className="stat-foot" style={{ margin: "10px 0 0" }}>
              Only HR admins{isSelf ? " and you" : " and this person"} can see these. Changes are logged without the numbers themselves.
            </p>
          </Section>
          <Section title="Recent payslips">
            {(() => {
              const approved = new Map(state.payrollRuns.filter((r) => r.status === "Approved").map((r) => [r.id, r]));
              const lines = state.payrollLines.filter((l) => l.employeeId === e.id && approved.has(l.runId)).sort((a, b) => approved.get(b.runId)!.period.localeCompare(approved.get(a.runId)!.period));
              return lines.length === 0 ? (
                <p className="stat-foot" style={{ margin: 0 }}>
                  No approved payslips yet.
                </p>
              ) : (
                <ul className="list">
                  {lines.slice(0, 6).map((l) => (
                    <li key={l.id} className="list-row">
                      <div className="person-info">
                        <strong>{periodLabel(approved.get(l.runId)!.period)}</strong>
                        <span>
                          Gross {formatNaira(Math.round(l.gross))} · PAYE {formatNaira(Math.round(l.paye))}
                        </span>
                      </div>
                      <strong>{formatNaira(Math.round(l.net))}</strong>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Section>
        </div>
      ) : null}

      {tab === "time" ? (
        <div className="profile-grid">
          <Section title={`Leave ${year ?? ""}`}>
            {balance ? (
              <div className="mini-stats">
                <div>
                  <strong>{balance.remaining}</strong>
                  <span>days left</span>
                </div>
                <div>
                  <strong>{balance.taken}</strong>
                  <span>taken</span>
                </div>
                <div>
                  <strong>{balance.pending}</strong>
                  <span>pending</span>
                </div>
                <div>
                  <strong>{balance.allowance}</strong>
                  <span>allowance</span>
                </div>
              </div>
            ) : null}
            {leave.length ? (
              <ul className="timeline" style={{ marginTop: 12 }}>
                {leave.slice(0, 8).map((l) => (
                  <li key={l.id} style={{ justifyContent: "space-between" }}>
                    <div>
                      <strong>{l.leaveType}</strong> · {pluralise(l.days, "day")}
                      <span>
                        {d(l.startDate)} – {d(l.endDate)}
                      </span>
                    </div>
                    <Badge tone={l.status === "Approved" ? "ok" : l.status === "Pending" ? "warn" : "neutral"}>{l.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="stat-foot" style={{ margin: "10px 0 0" }}>
                No leave recorded.
              </p>
            )}
          </Section>
          <Section title="Attendance, last 2 weeks">
            {att.length === 0 ? null : (
              <ul className="att-list">
                {att.map(({ day, r }) => (
                  <li key={day}>
                    <span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}</span>
                    <span>{r ? `${lagosTime(r.clockIn)} – ${r.clockOut ? lagosTime(r.clockOut) : "…"}` : state.leave.some((l) => l.employeeId === e.id && l.status === "Approved" && l.startDate <= day && l.endDate >= day) ? "On leave" : "Not in"}</span>
                    <span>{r ? `${r.mode}${r.clockOut ? ` · ${hoursWorked(r)?.toFixed(1)} h` : ""}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}

      {tab === "performance" ? (
        <div className="profile-grid">
          <Section title="Reviews">
            {reviews.length === 0 ? (
              <p className="stat-foot" style={{ margin: 0 }}>
                No reviews yet.
              </p>
            ) : (
              <ul className="timeline">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>
                        {r.cycle}: {r.status}
                        {r.rating ? `, ${r.rating}/5` : ""}
                      </strong>
                      <span>
                        {r.reviewerName ? `By ${r.reviewerName}` : ""}
                        {r.summary ? ` · ${r.summary}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Goals they own">
            {state.goals.filter((g) => g.ownerName === e.name).length === 0 ? (
              <p className="stat-foot" style={{ margin: 0 }}>
                No goals owned.
              </p>
            ) : (
              <ul className="goal-list">
                {state.goals
                  .filter((g) => g.ownerName === e.name)
                  .map((g) => (
                    <li key={g.id} className="goal">
                      <div className="goal-main">
                        <strong>{g.title}</strong>
                        <span>Due {d(g.dueDate)}</span>
                        <div className="bar goal-bar" aria-label={`${g.progress}% complete`}>
                          <i style={{ width: `${g.progress}%` }} />
                        </div>
                      </div>
                      <strong>{g.progress}%</strong>
                    </li>
                  ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}

      {!hasRecord ? (
        <div style={{ marginTop: 16 }}>
          <Notice>Personal details, next of kin and bank information are visible to HR admins and the person only.</Notice>
        </div>
      ) : null}

      {editing === "basics" ? (
        <Modal title={`Edit ${e.name}`} onClose={() => setEditing(null)} wide>
          <EmployeeForm
            initial={e}
            showPay={false}
            managers={managers}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              act({ type: "employee/update", employeeId: e.id, input });
              toast("Changes saved.");
              setEditing(null);
            }}
          />
        </Modal>
      ) : null}
      {editing === "personal" ? (
        <Modal title={`Personal details · ${e.name}`} onClose={() => setEditing(null)} wide>
          <PersonalForm
            initial={rec.personal}
            today={todayIso}
            self={isSelf}
            onCancel={() => setEditing(null)}
            onSave={(personal) => {
              act({ type: "employee/updatePersonal", employeeId: e.id, personal });
              toast("Personal details saved.");
              setEditing(null);
            }}
          />
        </Modal>
      ) : null}
      {editing === "job" ? (
        <Modal title={`Job and contract · ${e.name}`} onClose={() => setEditing(null)} wide>
          <JobDetailsForm
            initial={rec.job}
            onCancel={() => setEditing(null)}
            onSave={(job) => {
              if (job.staffId && Object.entries(state.records).some(([id, r]) => id !== e.id && r.job.staffId.toLowerCase() === job.staffId.toLowerCase())) {
                toast("Another person already has that staff ID.");
                return;
              }
              act({ type: "employee/updateJob", employeeId: e.id, job });
              toast("Job details saved.");
              setEditing(null);
            }}
          />
        </Modal>
      ) : null}
      {editing === "bank" ? (
        <Modal title={`Bank and statutory · ${e.name}`} onClose={() => setEditing(null)} wide>
          <BankForm
            initial={bank ?? EMPTY_BANK}
            onCancel={() => setEditing(null)}
            onSave={(b) => {
              act({ type: "employee/updateBank", employeeId: e.id, bank: b });
              toast("Bank and statutory details saved.");
              setEditing(null);
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

