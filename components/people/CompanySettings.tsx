"use client";

import { useState } from "react";
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
