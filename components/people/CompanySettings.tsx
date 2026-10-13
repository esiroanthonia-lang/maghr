"use client";

import { useState, type ChangeEvent } from "react";
import { formatDate } from "@/lib/format";
import { suggestSlug, validCareersSettings } from "@/lib/careers";
import { nigeriaFixedHolidays } from "@/lib/holidays";
import { bandLabel, DEFAULT_PAYROLL_CONFIG, validConfig, type PayrollConfig, type TaxBand } from "@/lib/paye";
import { Panel } from "../ui/bits";
import { useToast } from "../ui/Toast";
import { usePeople } from "./usePeople";

export function CompanySettingsPanel() {
  const { state, act, can } = usePeople();
  const toast = useToast();
  const [name, setName] = useState(state.settings.companyName);
  const [days, setDays] = useState(String(state.settings.leaveAllowanceDays));
  const [start, setStart] = useState(state.settings.workStart);
  const editable = can("settings/update");
  const n = Number(days);
  const valid = name.trim().length >= 2 && Number.isInteger(n) && n >= 0 && n <= 60 && /^([01]\d|2[0-3]):[0-5]\d$/.test(start);
  const changed = name.trim() !== state.settings.companyName || n !== state.settings.leaveAllowanceDays || start !== state.settings.workStart;

  return (
    <Panel title="Company" subtitle={editable ? "Applies to everyone in this workspace" : "Only HR admins can change these"}>
      <form
        className="panel-body settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return toast("Check the company name, allowance (0–60 days) and start time.");
          act({ type: "settings/update", settings: { companyName: name.trim(), leaveAllowanceDays: n, workStart: start } });
          toast("Company settings saved.");
        }}
      >
        <div className="field">
          <label htmlFor="set-name">Company name</label>
          <input id="set-name" value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="set-days">Annual leave allowance (working days)</label>
          <input id="set-days" inputMode="numeric" value={days} disabled={!editable} onChange={(e) => setDays(e.target.value)} />
          <span className="hint">Used for every employee’s balance. Nigeria’s Labour Act sets a minimum of 6 working days after 12 months’ service; most companies give more.</span>
        </div>
        <div className="field">
          <label htmlFor="set-start">Working day starts at</label>
          <input id="set-start" type="time" value={start} disabled={!editable} onChange={(e) => setStart(e.target.value)} />
          <span className="hint">Lagos time. Clock-ins more than 15 minutes after this are marked late on the attendance board.</span>
        </div>
        <div className="field">
          <label htmlFor="set-currency">Currency</label>
          <select id="set-currency" disabled value="NGN">
            <option value="NGN">Nigerian naira (₦)</option>
          </select>
        </div>
        {editable ? (
          <div>
            <button className="btn primary" disabled={!changed || !valid}>
              Save changes
            </button>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}

export function HolidaysPanel() {
  const { state, act, can, year } = usePeople();
  const toast = useToast();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const editable = can("settings/addHoliday");
  const y = year ?? new Date().getUTCFullYear();
  const national = [...nigeriaFixedHolidays(y), ...nigeriaFixedHolidays(y + 1)];
  const upcomingCompany = state.holidays.filter((h) => h.date >= `${y}-01-01`);

  return (
    <Panel title="Public holidays" subtitle="Skipped automatically when counting leave days">
      <div className="panel-body holidays">
        <div>
          <h3 className="holidays-h">National holidays (calculated)</h3>
          <ul className="holiday-list">
            {national.map((h) => (
              <li key={h.date}>
                <span>{h.name}</span>
                <time dateTime={h.date}>{formatDate(`${h.date}T12:00:00Z`)}</time>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="holidays-h">Company and announced holidays</h3>
          <p className="stat-foot" style={{ marginTop: 0 }}>
            Add Eid-el-Fitr, Eid-el-Kabir and Eid-el-Maulud once the Federal Government announces the dates, plus any substitute days or company days off.
          </p>
          {upcomingCompany.length ? (
            <ul className="holiday-list">
              {upcomingCompany.map((h) => (
                <li key={h.id}>
                  <span>{h.name}</span>
                  <span className="holiday-actions">
                    <time dateTime={h.date}>{formatDate(`${h.date}T12:00:00Z`)}</time>
                    {editable ? (
                      <button
                        type="button"
                        className="link-btn"
                        aria-label={`Remove ${h.name}`}
                        onClick={() => {
                          act({ type: "settings/removeHoliday", holidayId: h.id });
                          toast(`${h.name} removed.`);
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="stat-foot">None added yet.</p>
          )}
          {editable ? (
            <form
              className="holiday-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!date || name.trim().length < 2) return toast("Enter a date and a name for the holiday.");
                if (state.holidays.some((h) => h.date === date)) return toast("There’s already a holiday on that date.");
                act({ type: "settings/addHoliday", date, name: name.trim() });
                toast(`${name.trim()} added.`);
                setDate("");
                setName("");
              }}
            >
              <label className="sr-only" htmlFor="hol-name">
                Holiday name
              </label>
              <input id="hol-name" className="control" placeholder="e.g. Eid-el-Fitr" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              <label className="sr-only" htmlFor="hol-date">
                Date
              </label>
              <input id="hol-date" className="control" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn">Add holiday</button>
            </form>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export function SettingsIntegrations() {
  const items = [
    ["MyJobMag job posting & CV database", "Needs MyJobMag API approval"],
    ["WhatsApp Business", "Needs a WhatsApp Business Platform account"],
    ["Email sender (SMTP)", "Set up in Supabase → Authentication → Emails"],
    ["Salary payments", "MagHR prepares the bank schedule; paying out needs a licensed payment provider"],
  ];
  return (
    <Panel title="Integrations" subtitle="What’s connected">
      <ul className="list">
        {items.map(([name, note]) => (
          <li key={name} className="list-row">
            <div className="person-info">
              <strong>{name}</strong>
              <span>{note}</span>
            </div>
            <span className="badge neutral">Not connected</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Public careers page: on/off, web address and a short welcome. */
export function CareersPanel() {
  const { state, act, can } = usePeople();
  const toast = useToast();
  const editable = can("settings/careers");
  const [enabled, setEnabled] = useState(state.careers.enabled);
  const [slug, setSlug] = useState(state.careers.slug || suggestSlug(state.settings.companyName));
  const [intro, setIntro] = useState(state.careers.intro);
  const next = { enabled, slug: slug.trim().toLowerCase(), intro: intro.trim() };
  const valid = validCareersSettings(next);
  const changed = next.enabled !== state.careers.enabled || next.slug !== state.careers.slug || next.intro !== state.careers.intro;
  const path = `/careers/${state.careers.slug}`;
  const open = state.jobs.filter((j) => j.status === "Open").length;

  return (
    <Panel title="Careers page" subtitle={editable ? "A public page listing your open jobs, where people can apply" : "Only HR admins can change this"}>
      <form
        className="panel-body settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return toast("Use 3–40 lowercase letters, numbers or dashes for the web address.");
          act({ type: "settings/careers", careers: next });
          toast(next.enabled ? "Careers page saved. It’s live." : "Careers page saved. It’s switched off.");
        }}
      >
        <label className="switch-row" htmlFor="car-on">
          <input id="car-on" type="checkbox" checked={enabled} disabled={!editable} onChange={(e) => setEnabled(e.target.checked)} />
          <span>
            <strong>Show our careers page</strong>
            <span className="hint">Only jobs marked Open appear. Applicants go straight into the pipeline as “Careers page”.</span>
          </span>
        </label>
        <div className="field">
          <label htmlFor="car-slug">Web address</label>
          <div className="prefixed">
            <span aria-hidden="true">/careers/</span>
            <input id="car-slug" value={slug} disabled={!editable} maxLength={40} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} aria-describedby="car-slug-hint" />
          </div>
          <span className="hint" id="car-slug-hint">
            Lowercase letters, numbers and dashes, e.g. {suggestSlug(state.settings.companyName) || "your-company"}.
          </span>
        </div>
        <div className="field">
          <label htmlFor="car-intro">Welcome text (optional)</label>
          <textarea id="car-intro" rows={3} maxLength={600} value={intro} disabled={!editable} onChange={(e) => setIntro(e.target.value)} />
          <span className="hint">{600 - intro.length} characters left. Say what it’s like to work with you.</span>
        </div>
        {state.careers.enabled && state.careers.slug ? (
          <div className="notice" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 180 }}>
              Live with {open} open {open === 1 ? "role" : "roles"}: <a href={path} target="_blank" rel="noopener">{path}</a>
            </span>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                const url = `${window.location.origin}${path}`;
                navigator.clipboard?.writeText(url).then(
                  () => toast("Link copied. Share it on WhatsApp, LinkedIn or your website."),
                  () => toast(url),
                );
              }}
            >
              Copy link
            </button>
          </div>
        ) : null}
        {editable ? (
          <div>
            <button className="btn primary" disabled={!changed || !valid}>
              Save careers page
            </button>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}

/** PAYE, pension and NHF rules. Defaults follow the Nigeria Tax Act 2025; a payroll professional confirms them. */
export function PayrollRulesPanel() {
  const { state, act, can, isAdmin } = usePeople();
  const toast = useToast();
  const editable = can("settings/payroll");
  const [c, setC] = useState<PayrollConfig>(state.payrollConfig);
  const [confirm, setConfirm] = useState(false);
  if (!isAdmin) return null;
  const valid = validConfig(c);
  const num = (k: keyof PayrollConfig) => (e: ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) });
  const setBand = (i: number, patch: Partial<TaxBand>) => setC({ ...c, bands: c.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const other = 100 - c.basicPct - c.housingPct - c.transportPct;
  const saved = state.payrollConfig;

  return (
    <Panel
      title="Payroll rules"
      subtitle={saved.confirmedBy ? `Confirmed by ${saved.confirmedBy}${saved.confirmedAt ? `, ${formatDate(saved.confirmedAt)}` : ""}` : "Not confirmed yet: payslips show as estimates"}
    >
      <form
        className="panel-body payroll-rules"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return toast("Check the tax bands climb in order and the pay split adds up to 100% or less.");
          act({ type: "settings/payroll", config: c, confirm });
          toast(confirm ? "Payroll rules saved and confirmed." : "Payroll rules saved. They’ll show as estimates until confirmed.");
          setConfirm(false);
        }}
      >
        <fieldset disabled={!editable}>
          <legend>How monthly gross is split</legend>
          <div className="rules-grid">
            <div className="field">
              <label htmlFor="pr-basic">Basic %</label>
              <input id="pr-basic" inputMode="decimal" value={c.basicPct} onChange={num("basicPct")} />
            </div>
            <div className="field">
              <label htmlFor="pr-housing">Housing %</label>
              <input id="pr-housing" inputMode="decimal" value={c.housingPct} onChange={num("housingPct")} />
            </div>
            <div className="field">
              <label htmlFor="pr-transport">Transport %</label>
              <input id="pr-transport" inputMode="decimal" value={c.transportPct} onChange={num("transportPct")} />
            </div>
            <div className="field">
              <span className="label">Other allowances</span>
              <strong className={other < 0 ? "rules-bad" : "rules-other"}>{other}%</strong>
            </div>
          </div>
        </fieldset>

        <fieldset disabled={!editable}>
          <legend>Pension, NHF and minimum wage</legend>
          <div className="rules-grid">
            <div className="field">
              <label htmlFor="pr-pee">Employee pension %</label>
              <input id="pr-pee" inputMode="decimal" value={c.pensionEmployeeRate} onChange={num("pensionEmployeeRate")} />
            </div>
            <div className="field">
              <label htmlFor="pr-per">Employer pension %</label>
              <input id="pr-per" inputMode="decimal" value={c.pensionEmployerRate} onChange={num("pensionEmployerRate")} />
            </div>
            <div className="field">
              <label htmlFor="pr-nhf">NHF % of basic</label>
              <input id="pr-nhf" inputMode="decimal" value={c.nhfRate} disabled={!c.nhfEnabled || !editable} onChange={num("nhfRate")} />
              <label className="inline-check">
                <input type="checkbox" checked={c.nhfEnabled} onChange={(e) => setC({ ...c, nhfEnabled: e.target.checked })} /> Deduct NHF
              </label>
            </div>
            <div className="field">
              <label htmlFor="pr-minw">Minimum wage (₦/month)</label>
              <input id="pr-minw" inputMode="numeric" value={c.minimumWageMonthly} onChange={num("minimumWageMonthly")} />
            </div>
          </div>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            Pension is worked out on basic + housing + transport (Pension Reform Act 2014). People earning the minimum wage or less pay no PAYE.
          </p>
        </fieldset>

        <fieldset disabled={!editable}>
          <legend>PAYE (annual taxable income)</legend>
          <div className="rules-grid">
            <div className="field">
              <label htmlFor="pr-rr">Rent relief % of rent paid</label>
              <input id="pr-rr" inputMode="decimal" value={c.rentReliefRate} onChange={num("rentReliefRate")} />
            </div>
            <div className="field">
              <label htmlFor="pr-rrcap">Rent relief cap (₦/year)</label>
              <input id="pr-rrcap" inputMode="numeric" value={c.rentReliefCap} onChange={num("rentReliefCap")} />
            </div>
          </div>
          <table className="bands-table">
            <caption className="sr-only">Tax bands</caption>
            <thead>
              <tr>
                <th scope="col">Band</th>
                <th scope="col">Up to (₦/year)</th>
                <th scope="col">Rate %</th>
              </tr>
            </thead>
            <tbody>
              {c.bands.map((b, i) => (
                <tr key={i}>
                  <td>{bandLabel(c.bands, i)}</td>
                  <td>
                    {b.upTo === null ? (
                      <span className="stat-foot">and above</span>
                    ) : (
                      <input aria-label={`Band ${i + 1} upper limit`} className="control" inputMode="numeric" value={b.upTo} onChange={(e) => setBand(i, { upTo: Number(e.target.value) })} />
                    )}
                  </td>
                  <td>
                    <input aria-label={`Band ${i + 1} rate`} className="control" inputMode="decimal" value={b.rate} onChange={(e) => setBand(i, { rate: Number(e.target.value) })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="link-btn" onClick={() => setC({ ...DEFAULT_PAYROLL_CONFIG, confirmedBy: c.confirmedBy, confirmedAt: c.confirmedAt })}>
            Reset to Nigeria Tax Act 2025 defaults
          </button>
        </fieldset>

        {editable ? (
          <>
            <label className="switch-row" htmlFor="pr-confirm">
              <input id="pr-confirm" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              <span>
                <strong>These rules have been checked by a qualified payroll professional</strong>
                <span className="hint">Your name is recorded. Changing any rule later clears the confirmation until someone checks again.</span>
              </span>
            </label>
            <div>
              <button className="btn primary" disabled={!valid}>
                {confirm ? "Save and confirm" : "Save payroll rules"}
              </button>
            </div>
          </>
        ) : null}
      </form>
    </Panel>
  );
}
