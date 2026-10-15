"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { botReply, decisionMessage, startSession, type BotResult, type Persona, type Session } from "@/lib/whatsapp";
import { useDemoStore, useNow } from "@/lib/store";
import type { SelfServiceRequest } from "@/lib/types";
import { Badge, EmptyState, Notice, PageHeader, Panel, RelativeTime, StatCard } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

interface Msg {
  id: number;
  from: "bot" | "user";
  text: string;
}

interface Thread {
  session: Session;
  messages: Msg[];
  quick: string[];
}

/** Renders WhatsApp-style *bold* and _italic_ text plus line breaks. */
function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  text.split(/(\*[^*]+\*|_[^_]+_)/g).forEach((chunk, i) => {
    if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) parts.push(<strong key={i}>{chunk.slice(1, -1)}</strong>);
    else if (chunk.startsWith("_") && chunk.endsWith("_") && chunk.length > 2) parts.push(<em key={i}>{chunk.slice(1, -1)}</em>);
    else parts.push(chunk);
  });
  return <>{parts}</>;
}

let msgId = 0;
const toMessages = (replies: string[], from: Msg["from"] = "bot"): Msg[] => replies.map((text) => ({ id: ++msgId, from, text }));

export function WhatsAppDesk() {
  const { state, act, workspace } = useDemoStore();
  const now = useNow();
  const toast = useToast();

  const candidates = state.candidates.filter((c) => c.jobId);
  const personas: { key: string; label: string; persona: Persona }[] = [
    ...candidates.slice(0, 8).map((c) => ({
      key: `c:${c.id}`,
      label: `${c.name} · candidate`,
      persona: { role: "Candidate" as const, candidateId: c.id },
    })),
    ...state.employees.map((e) => ({
      key: `e:${e.id}`,
      label: `${e.name} · employee`,
      persona: { role: "Employee" as const, employeeId: e.id },
    })),
  ];
  const defaultKey = personas.find((p) => p.persona.role === "Employee")?.key ?? personas[0]?.key ?? "";
  const [activeKey, setActiveKey] = useState(defaultKey);
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const active = personas.find((p) => p.key === activeKey) ?? personas[0];
  const thread = active ? threads[active.key] : undefined;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [thread?.messages.length, activeKey]);

  function ensureThread(): Thread | null {
    if (!active) return null;
    if (threads[active.key]) return threads[active.key];
    const r = startSession(active.persona, state);
    return { session: r.session, messages: toMessages(r.replies), quick: r.quick };
  }

  function applyEffects(r: BotResult) {
    for (const e of r.effects) {
      if (e.type === "inbox") act({ type: "inbox/add", request: e.request });
      if (e.type === "withdraw") act({ type: "candidate/moveStage", candidateId: e.candidateId, to: "Withdrawn", by: "Candidate (WhatsApp)" });
    }
  }

  function send(text: string) {
    const t = ensureThread();
    if (!t || !active || !now || !text.trim()) return;
    const r = botReply(t.session, text, state, now);
    applyEffects(r);
    setThreads((all) => ({
      ...all,
      [active.key]: { session: r.session, messages: [...t.messages, ...toMessages([text.trim()], "user"), ...toMessages(r.replies)], quick: r.quick },
    }));
    setDraft("");
  }

  function startChat() {
    const t = ensureThread();
    if (t && active) setThreads((all) => ({ ...all, [active.key]: t }));
  }

  function decide(request: SelfServiceRequest, status: SelfServiceRequest["status"]) {
    act({ type: "inbox/setStatus", requestId: request.id, status });
    const message = decisionMessage({ ...request, status });
    const employee = state.employees.find((e) => e.name === request.from);
    if (message && employee) {
      const key = `e:${employee.id}`;
      setThreads((all) => {
        const existing = all[key];
        if (!existing) return all;
        return { ...all, [key]: { ...existing, messages: [...existing.messages, ...toMessages([message])] } };
      });
    }
    toast(`${request.kind} from ${request.from}: ${status.toLowerCase()}.${message ? " Reply sent on WhatsApp (demo)." : ""}`);
  }

  const open = state.inbox.filter((r) => r.status === "New");
  if (workspace.mode === "live") {
    return (
      <>
        <PageHeader eyebrow="MEET PEOPLE WHERE THEY ALREADY ARE" title="WhatsApp desk" intro="Not connected yet." />
        <Panel title="WhatsApp Business not connected">
          <EmptyState title="Connect a WhatsApp Business Platform account to switch this on">
            You’ll need an approved business number, message templates, and opt-in from each employee and candidate.
          </EmptyState>
        </Panel>
      </>
    );
  }
  const auto = state.inbox.filter((r) => r.status === "Answered automatically").length;

  return (
    <>
      <PageHeader
        eyebrow="MEET PEOPLE WHERE THEY ALREADY ARE"
        title="WhatsApp desk"
        intro="Candidates check their application and staff request leave or payslips by WhatsApp. Anything that needs a decision lands here for HR."
      />
      <div className="stats">
        <StatCard label="Needs HR action" icon="bell" tone="orange" value={open.length} foot="Leave and payslip requests" />
        <StatCard label="Answered automatically" icon="check" tone="green" value={auto} foot="Status checks, withdrawals" />
        <StatCard label="Total conversations" icon="chat" tone="blue" value={state.inbox.length} foot="Logged from WhatsApp" />
        <StatCard label="Typical reply time" icon="clock" tone="purple" demo value="Instant" foot="For automated answers" />
      </div>

      <div className="wa-layout">
        <section aria-label="WhatsApp simulator">
          <div className="wa-picker">
            <label htmlFor="wa-persona" className="field-label">
              Try it as…
            </label>
            <select id="wa-persona" className="control" value={active?.key ?? ""} onChange={(e) => setActiveKey(e.target.value)}>
              {personas.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="phone">
            <div className="wa-head">
              <span className="wa-avatar" aria-hidden="true">M</span>
              <div>
                <strong>Membra · MyJobMag</strong>
                <span>Business account · demo</span>
              </div>
            </div>
            <div className="wa-body" ref={scroller} role="log" aria-live="polite" aria-label="Conversation">
              {!thread ? (
                <div className="wa-empty">
                  <p>Start a chat as {active?.label.split(" · ")[0]}.</p>
                  <button type="button" className="btn primary" onClick={startChat} disabled={!now}>
                    Say hello
                  </button>
                </div>
              ) : (
                thread.messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.from}`}>
                    <Rich text={m.text} />
                  </div>
                ))
              )}
            </div>
            {thread ? (
              <>
                {thread.quick.length ? (
                  <div className="wa-quick" aria-label="Quick replies">
                    {thread.quick.map((q) => (
                      <button key={q} type="button" onClick={() => send(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}
                <form
                  className="wa-input"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(draft);
                  }}
                >
                  <label htmlFor="wa-text" className="sr-only">
                    Message
                  </label>
                  <input id="wa-text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message" autoComplete="off" />
                  <button type="submit" aria-label="Send" disabled={!draft.trim()}>
                    <Icon name="send" size={16} />
                  </button>
                </form>
              </>
            ) : null}
          </div>
          <div style={{ marginTop: 12 }}>
            <Notice>Simulated. Going live needs a WhatsApp Business Platform account, approved message templates and opt-in from each person.</Notice>
          </div>
        </section>

        <Panel title="HR inbox" subtitle="Requests from WhatsApp. Nothing is approved without a person.">
          {state.inbox.length === 0 ? (
            <EmptyState title="No requests yet">Try the simulator to send one.</EmptyState>
          ) : (
            <ul className="list inbox">
              {state.inbox.map((r) => (
                <li key={r.id} className="list-row" data-request={r.id}>
                  <span className={`inbox-ico ${r.role === "Employee" ? "emp" : "cand"}`} aria-hidden="true">
                    <Icon name={r.kind === "Leave request" ? "calendar" : r.kind === "Payslip request" ? "naira" : "chat"} size={15} />
                  </span>
                  <div className="person-info">
                    <strong>
                      {r.kind} · {r.from}
                    </strong>
                    <span>
                      {r.role} · {r.detail} · <RelativeTime iso={r.at} />
                    </span>
                  </div>
                  {r.status === "New" && r.kind === "Leave request" ? (
                    <div className="button-row">
                      <button type="button" className="btn small" onClick={() => decide(r, "Approved")}>
                        Approve
                      </button>
                      <button type="button" className="btn small" onClick={() => decide(r, "Declined")}>
                        Decline
                      </button>
                    </div>
                  ) : r.status === "New" && r.kind === "Payslip request" ? (
                    <button type="button" className="btn small" onClick={() => decide(r, "Sent")}>
                      Mark link sent
                    </button>
                  ) : (
                    <Badge tone={r.status === "Approved" || r.status === "Sent" ? "ok" : r.status === "Declined" ? "bad" : "neutral"}>{r.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
