"use client";

import { useState } from "react";
import type { Employee } from "@/lib/types";
import { usePeople } from "./usePeople";

type Letter = "offer" | "confirmation" | "experience";
const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
const date = (value: string) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "[date]";

export function EmployeeLetters({ employee, confirmedOn }: { employee: Employee; confirmedOn: string }) {
  const { state, isAdmin } = usePeople();
  const [letter, setLetter] = useState<Letter>(confirmedOn ? "confirmation" : "offer");
  if (!isAdmin) return null;

  function printLetter() {
    const company = escapeHtml(state.settings.companyName || "Your company");
    const name = escapeHtml(employee.name);
    const title = escapeHtml(employee.jobTitle);
    const department = escapeHtml(employee.department);
    const startDate = date(employee.startDate);
    const confirmedDate = date(confirmedOn);
    const today = new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(new Date());
    const copy: Record<Letter, { subject: string; body: string }> = {
      offer: {
        subject: "Offer of Employment",
        body: `<p>We are pleased to offer you the position of <strong>${title}</strong> in the ${department} team at ${company}, starting on <strong>${startDate}</strong>.</p><p>This offer is subject to the terms in your employment contract and completion of the required pre-employment checks. Please sign and return your contract to confirm acceptance.</p><p>We look forward to welcoming you to the team.</p>`,
      },
      confirmation: {
        subject: "Confirmation of Employment",
        body: `<p>We are pleased to confirm your appointment as <strong>${title}</strong> in the ${department} team at ${company}, effective <strong>${confirmedDate}</strong>.</p><p>Thank you for your contribution during your probation period. Your existing employment terms continue to apply.</p><p>We look forward to your continued contribution.</p>`,
      },
      experience: {
        subject: "Employment Experience Letter",
        body: `<p>This is to confirm that <strong>${name}</strong> was employed by ${company} as <strong>${title}</strong> in the ${department} team from <strong>${startDate}</strong>${employee.exitedOn ? ` to <strong>${date(employee.exitedOn)}</strong>` : " and remains employed with us"}.</p><p>This letter is issued at the employee’s request.</p>`,
      },
    };
    const selected = copy[letter];
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(selected.subject)} — ${name}</title><style>body{font:16px/1.7 Georgia,serif;color:#18221d;max-width:760px;margin:72px auto;padding:0 48px}header{border-bottom:2px solid #1c6548;padding-bottom:18px;margin-bottom:44px}header strong{font:700 22px Arial,sans-serif;color:#1c6548}time{display:block;text-align:right;margin-bottom:38px}h1{font:700 23px Arial,sans-serif;margin:0 0 32px}p{margin:0 0 20px}.sign{margin-top:64px}.sign div{width:230px;border-top:1px solid #53615a;padding-top:8px;margin-top:42px}@media print{body{margin:30mm auto;padding:0}button{display:none}}</style></head><body><header><strong>${company}</strong><div>${escapeHtml(state.settings.companyName)}</div></header><time>${today}</time><h1>${escapeHtml(selected.subject)}</h1><p>Dear ${name},</p>${selected.body}<div class="sign"><p>Yours sincerely,</p><div><strong>Human Resources</strong><br>${company}</div></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`);
    popup.document.close();
  }

  return <section className="panel employee-letters">
    <div className="panel-head"><div><h2>Letters and templates</h2><p>Prepared from this employee’s profile · review before issuing</p></div></div>
    <div className="panel-body employee-letter-controls">
      <label className="field"><span className="label">Letter type</span><select className="control" value={letter} onChange={(event) => setLetter(event.target.value as Letter)}><option value="offer">Offer letter</option><option value="confirmation" disabled={!confirmedOn}>Confirmation letter{!confirmedOn ? " · confirm employment first" : ""}</option><option value="experience">Experience letter</option></select></label>
      <button type="button" className="btn primary" onClick={printLetter}>Print / Save as PDF</button>
      <p className="stat-foot">Your browser’s print dialog lets you save the finished letter as a PDF. Add your company’s approved terms and authorised signatory before sending.</p>
    </div>
  </section>;
}
