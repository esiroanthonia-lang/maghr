// Unit tests for the scripted WhatsApp assistant. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createDemoData } from "../lib/demo-data";
import { botReply, decisionMessage, previousMonths, startSession, type Persona } from "../lib/whatsapp";

const NOW = new Date("2026-10-12T13:00:00Z");
const state = createDemoData(NOW);
const cand = (name: string): Persona => ({ role: "Candidate", candidateId: state.candidates.find((c) => c.name === name)!.id });
const grace: Persona = { role: "Employee", employeeId: "emp-001" };

function chat(persona: Persona, inputs: string[]) {
  let r = startSession(persona, state);
  const effects = [];
  for (const i of inputs) {
    r = botReply(r.session, i, state, NOW);
    effects.push(...r.effects);
  }
  return { last: r, effects };
}

describe("WhatsApp assistant — candidates", () => {
  it("greets by first name and shows the menu", () => {
    const r = startSession(cand("Amaka Okafor"), state);
    assert.match(r.replies[0], /Hello Amaka/);
    assert.deepEqual(r.quick, ["1", "2", "3"]);
  });

  it("explains the stage in plain words and logs an automatic answer", () => {
    const { last, effects } = chat(cand("Zainab Yusuf"), ["1"]);
    assert.match(last.replies[0], /shortlisted/);
    assert.equal(effects[0].type, "inbox");
  });

  it("never reveals reviewer notes or ratings", () => {
    const { last } = chat(cand("Tunde Mohammed"), ["1"]);
    const all = last.replies.join(" ");
    assert.doesNotMatch(all, /take-home|accessibility testing|rating|★/i);
  });

  it("gives interview details when one is booked", () => {
    const { last } = chat(cand("Tunde Mohammed"), ["2"]);
    assert.match(last.replies[0], /Video call/);
  });

  it("only withdraws after an explicit YES", () => {
    const no = chat(cand("Amaka Okafor"), ["3", "no"]);
    assert.equal(no.effects.length, 0);
    const yes = chat(cand("Amaka Okafor"), ["3", "YES"]);
    assert.ok(yes.effects.some((e) => e.type === "withdraw"));
  });
});

describe("WhatsApp assistant — employees", () => {
  it("collects a leave request step by step and sends it to HR as New", () => {
    const { last, effects } = chat(grace, ["1", "1", "20/10", "3", "yes"]);
    assert.match(last.replies[0], /Sent to HR/);
    const e = effects.find((x) => x.type === "inbox");
    assert.ok(e && e.type === "inbox");
    assert.equal(e.request.status, "New");
    assert.equal(e.request.detail, "Annual leave · 3 days from 20/10/2026");
  });

  it("re-asks on invalid dates and day counts", () => {
    assert.match(chat(grace, ["1", "2", "31/02"]).last.replies[0], /DD\/MM/);
    assert.match(chat(grace, ["1", "2", "20/10", "45"]).last.replies[0], /1 to 30/);
  });

  it("treats a date earlier this year as next year", () => {
    const { effects } = chat(grace, ["1", "1", "05/01", "1", "yes"]);
    const e = effects[0];
    assert.ok(e.type === "inbox" && e.request.detail.endsWith("05/01/2027"));
  });

  it("requests a payslip without sending it in chat", () => {
    const { last, effects } = chat(grace, ["2", "1"]);
    assert.match(last.replies[0], /never sent as WhatsApp attachments/);
    const e = effects[0];
    assert.ok(e.type === "inbox" && e.request.detail === previousMonths(NOW)[0]);
    assert.equal(previousMonths(NOW)[0], "September 2026");
  });

  it("returns to the menu on 'menu' and cancels mid-flow", () => {
    const { last, effects } = chat(grace, ["1", "cancel"]);
    assert.equal(last.session.step, "menu");
    assert.equal(effects.length, 0);
  });

  it("writes a reply when HR decides", () => {
    const req = { id: "r", channel: "WhatsApp" as const, from: "Grace Nwosu", role: "Employee" as const, kind: "Leave request" as const, detail: "Annual", status: "Approved" as const, at: "" };
    assert.match(decisionMessage(req)!, /approved/);
    assert.equal(decisionMessage({ ...req, status: "New" }), null);
  });
});
