// Scripted WhatsApp self-service assistant (demo).
//
// Pure functions: given the conversation so far and what the person typed, return
// the bot's replies, the next conversation state and any effects for the app to
// apply (log a request in the HR inbox, or withdraw an application).
//
// Rules this keeps, and a live version must keep too:
// - Candidates only see their own stage in plain language. Never notes, ratings or reviewer comments.
// - Leave and payslip requests always go to a person in HR. The bot approves nothing itself.
// - Payslips are never sent as chat attachments. HR sends a secure link.

import type { DemoState } from "./demo-data";
import { TIME_ZONE, formatDateTime } from "./format";
import type { RequestKind, SelfServiceRequest } from "./types";

export type Persona = { role: "Candidate"; candidateId: string } | { role: "Employee"; employeeId: string };

export interface Session {
  persona: Persona;
  step:
    | "menu"
    | "withdraw-confirm"
    | "leave-type"
    | "leave-start"
    | "leave-days"
    | "leave-confirm"
    | "payslip-month";
  draft: { leaveType?: string; start?: string; days?: number };
}

export type Effect =
  | { type: "inbox"; request: Omit<SelfServiceRequest, "id" | "at" | "channel"> }
  | { type: "withdraw"; candidateId: string };

export interface BotResult {
  replies: string[];
  session: Session;
  effects: Effect[];
  /** Suggested quick replies to show as tappable chips. */
  quick: string[];
}

const LEAVE_TYPES = ["Annual leave", "Sick leave", "Other leave"];

function personaName(p: Persona, state: DemoState): string {
  if (p.role === "Candidate") return state.candidates.find((c) => c.id === p.candidateId)?.name ?? "there";
  return state.employees.find((e) => e.id === p.employeeId)?.name ?? "there";
}

function firstName(name: string) {
  return name.split(" ")[0];
}

export function previousMonths(now: Date, count = 2): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    out.push(new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: TIME_ZONE }).format(d));
  }
  return out;
}

function menu(p: Persona): { text: string; quick: string[] } {
  if (p.role === "Candidate") {
    return {
      text: "Reply with a number:\n1 · Check my application status\n2 · My interview details\n3 · Withdraw my application",
      quick: ["1", "2", "3"],
    };
  }
  return {
    text: "Reply with a number:\n1 · Request leave\n2 · Get my payslip\n3 · Check my leave balance",
    quick: ["1", "2", "3"],
  };
}

export function startSession(persona: Persona, state: DemoState): BotResult {
  const name = firstName(personaName(persona, state));
  const m = menu(persona);
  const intro =
    persona.role === "Candidate"
      ? `Hello ${name} 👋 This is the Membra hiring assistant for MyJobMag.`
      : `Hello ${name} 👋 This is Membra self-service for MyJobMag staff.`;
  return { replies: [intro, m.text], session: { persona, step: "menu", draft: {} }, effects: [], quick: m.quick };
}

function candidateStatusText(state: DemoState, candidateId: string, now: Date): string {
  const c = state.candidates.find((x) => x.id === candidateId);
  if (!c) return "I couldn’t find an application linked to this number.";
  const role = state.jobs.find((j) => j.id === c.jobId)?.title ?? "our talent pool";
  const next = c.interviews.find((i) => i.status === "Scheduled" && new Date(i.scheduledFor) >= now);
  switch (c.stage) {
    case "Applied":
      return `We’ve received your application for *${role}*. The hiring team will review it and get back to you.`;
    case "Screening":
      return `Your application for *${role}* is being reviewed by the hiring team.`;
    case "Shortlisted":
      return `Good news: you’ve been shortlisted for *${role}*. We’ll contact you about next steps.`;
    case "Interview":
      return next
        ? `You have an interview for *${role}* on ${formatDateTime(next.scheduledFor)} (${next.mode.toLowerCase()}).`
        : `You’re at the interview stage for *${role}*. The team is gathering feedback.`;
    case "Offer":
      return `You’re at the offer stage for *${role}*. Please check your email for details.`;
    case "Hired":
      return `Congratulations! You’ve been hired for *${role}*. The People team will be in touch about onboarding.`;
    case "Rejected":
      return `Thank you for applying for *${role}*. The team has decided not to move forward this time. You can still apply for other roles on MyJobMag.`;
    case "Withdrawn":
      return `Your application for *${role}* has been withdrawn.`;
  }
}

function parseDayMonth(text: string, now: Date): string | null {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = now.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1) return null; // e.g. 31/02
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (candidate.getTime() < today) year += 1; // a date earlier this year means next year
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function botReply(session: Session, rawInput: string, state: DemoState, now: Date): BotResult {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const p = session.persona;
  const name = personaName(p, state);
  const m = menu(p);
  const back = (replies: string[], effects: Effect[] = []): BotResult => ({
    replies: [...replies, m.text],
    session: { persona: p, step: "menu", draft: {} },
    effects,
    quick: m.quick,
  });
  const ask = (replies: string[], step: Session["step"], draft: Session["draft"], quick: string[] = []): BotResult => ({
    replies,
    session: { persona: p, step, draft },
    effects: [],
    quick,
  });
  const inbox = (kind: RequestKind, detail: string, status: SelfServiceRequest["status"]): Effect => ({
    type: "inbox",
    request: { from: name, role: p.role, kind, detail, status },
  });

  if (["hi", "hello", "menu", "0", "start", "cancel"].includes(lower)) {
    return back(lower === "cancel" ? ["Cancelled."] : []);
  }

  if (p.role === "Candidate") {
    const c = state.candidates.find((x) => x.id === p.candidateId);
    const role = state.jobs.find((j) => j.id === c?.jobId)?.title ?? "talent pool";
    if (session.step === "withdraw-confirm") {
      if (lower === "yes" && c) {
        return back(
          ["Your application has been withdrawn. Thank you for your interest in MyJobMag."],
          [{ type: "withdraw", candidateId: c.id }, inbox("Withdrawal", `${role} · withdrawn by candidate`, "Answered automatically")],
        );
      }
      return back(["Okay, your application stays active."]);
    }
    if (lower === "1") {
      const text = candidateStatusText(state, p.candidateId, now);
      return back([text], [inbox("Application status", `${role} · answered automatically`, "Answered automatically")]);
    }
    if (lower === "2") {
      const next = c?.interviews.find((i) => i.status === "Scheduled" && new Date(i.scheduledFor) >= now);
      return back([
        next
          ? `📅 ${formatDateTime(next.scheduledFor)}\nFormat: ${next.mode}\nWhere: ${next.location}\nWith: ${next.interviewers}`
          : "You don’t have an interview booked right now. We’ll message you if one is scheduled.",
      ]);
    }
    if (lower === "3") {
      if (!c || c.stage === "Withdrawn" || c.stage === "Rejected" || c.stage === "Hired") {
        return back(["There’s no active application to withdraw."]);
      }
      return ask([`Are you sure you want to withdraw your application for *${role}*? Reply YES to confirm, or NO to keep it.`], "withdraw-confirm", {}, ["YES", "NO"]);
    }
    return back(["Sorry, I didn’t understand that."]);
  }

  // Employee flows
  switch (session.step) {
    case "leave-type": {
      const idx = Number(lower) - 1;
      if (!LEAVE_TYPES[idx]) return ask(["Please reply 1, 2 or 3."], "leave-type", session.draft, ["1", "2", "3"]);
      return ask([`${LEAVE_TYPES[idx]}. What date does it start? Reply as DD/MM, e.g. 20/10.`], "leave-start", { leaveType: LEAVE_TYPES[idx] });
    }
    case "leave-start": {
      const start = parseDayMonth(input, now);
      if (!start) return ask(["Please send the date as DD/MM, e.g. 20/10."], "leave-start", session.draft);
      return ask(["How many working days? Reply with a number from 1 to 30."], "leave-days", { ...session.draft, start }, ["1", "2", "5"]);
    }
    case "leave-days": {
      const days = Number(lower);
      if (!Number.isInteger(days) || days < 1 || days > 30) return ask(["Please reply with a whole number from 1 to 30."], "leave-days", session.draft);
      const d = { ...session.draft, days };
      return ask([`Please confirm:\n*${d.leaveType}*, ${days} working day${days === 1 ? "" : "s"} from ${d.start}.\nReply YES to send to HR, or NO to cancel.`], "leave-confirm", d, ["YES", "NO"]);
    }
    case "leave-confirm": {
      const d = session.draft;
      if (lower === "yes") {
        return back(
          ["✅ Sent to HR for approval. I’ll message you here when they decide."],
          [inbox("Leave request", `${d.leaveType} · ${d.days} day${d.days === 1 ? "" : "s"} from ${d.start}`, "New")],
        );
      }
      return back(["Okay, I didn’t send it."]);
    }
    case "payslip-month": {
      const months = previousMonths(now);
      const month = months[Number(lower) - 1];
      if (!month) return ask([`Please reply 1 or 2.`], "payslip-month", {}, ["1", "2"]);
      return back(
        [`Request sent. HR will email you a secure, password-protected link to your ${month} payslip. For your privacy, payslips are never sent as WhatsApp attachments.`],
        [inbox("Payslip request", month, "New")],
      );
    }
    default:
      break;
  }

  if (lower === "1") return ask(["What type of leave?\n1 · Annual leave\n2 · Sick leave\n3 · Other"], "leave-type", {}, ["1", "2", "3"]);
  if (lower === "2") {
    const months = previousMonths(now);
    return ask([`Which payslip?\n1 · ${months[0]}\n2 · ${months[1]}`], "payslip-month", {}, ["1", "2"]);
  }
  if (lower === "3") return back(["Annual leave: *14 of 20 days* left this year.\n_(Demo figure. Live balances come with the Leave module.)_"]);
  return back(["Sorry, I didn’t understand that."]);
}

/** Message sent back to an employee when HR acts on their request. */
export function decisionMessage(request: SelfServiceRequest): string | null {
  if (request.kind === "Leave request" && request.status === "Approved") return `✅ Your leave request (${request.detail}) was approved by HR.`;
  if (request.kind === "Leave request" && request.status === "Declined") return `Your leave request (${request.detail}) was not approved. HR will contact you to discuss.`;
  if (request.kind === "Payslip request" && request.status === "Sent") return `📧 Your ${request.detail} payslip link has been emailed to you.`;
  return null;
}
