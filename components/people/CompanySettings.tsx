"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { nigeriaFixedHolidays } from "@/lib/holidays";
import { Panel } from "../ui/bits";
import { useToast } from "../ui/Toast";
import { usePeople } from "./usePeople";

export function CompanySettingsPanel() {
  const { state, act, can } = usePeople();
  const toast = useToast();
  const [name, setName] = useState(state.settings.companyName);
  const [days, setDays] = useState(String(state.settings.leaveAllowanceDays));
  const editable = can("settings/update");
  const n = Number(days);
  const valid = name.trim().length >= 2 && Number.isInteger(n) && n >= 0 && n <= 60;
  const changed = name.trim() !== state.settings.companyName || n !== state.settings.leaveAllowanceDays;

  return (
    <Panel title="Company" subtitle={editable ? "Applies to everyone in this workspace" : "Only HR admins can change these"}>
      <form
        className="panel-body settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return toast("Check the company name and allowance (0–60 days).");
          act({ type: "settings/update", settings: { companyName: name.trim(), leaveAllowanceDays: n } });
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
    ["Payroll deductions & payments", "Needs validated statutory rules and a licensed payment provider"],
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
