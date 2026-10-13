// Unit tests for full employee records. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { appReducer } from "../lib/app-reducer";
import { createDemoData } from "../lib/demo-data";
import { ageOn, checkBank, checkPersonal, completeness, emptyRecord, EMPTY_BANK, mask, missingItems, normalisePersonal } from "../lib/employee-record";
import type { PeopleAction } from "../lib/people";
import { rolesFor } from "../lib/workspace";

const NOW = new Date("2026-10-12T13:00:00Z");
const at = NOW.toISOString();
const run = (s: ReturnType<typeof createDemoData>, a: PeopleAction) => appReducer(s, a);

describe("employee records", () => {
  it("seeds a full synthetic record for everyone, with gaps for the new starter", () => {
    const s = createDemoData(NOW);
    for (const e of s.employees) assert.ok(s.records[e.id], e.name);
    const kemi = s.employees.find((e) => e.status === "Onboarding")!;
    assert.ok(missingItems(s.records[kemi.id], s.bank[kemi.id] ?? null, { includeBank: true }).includes("Bank account"));
    const tobi = s.employees.find((e) => e.name === "Tobi Ogun")!;
    assert.equal(completeness(s.records[tobi.id], s.bank[tobi.id], { includeBank: true }), 100);
    const ids = Object.values(s.records).map((r) => r.job.staffId);
    assert.equal(new Set(ids).size, ids.length, "staff IDs unique");
  });

  it("validates Nigerian bank, pension and tax numbers", () => {
    assert.deepEqual(checkBank({ ...EMPTY_BANK, bankName: "Zenith Bank", accountNumber: "0123456789", rsaPin: "PEN100200300400", tin: "12345678-0001" }), {});
    const e = checkBank({ ...EMPTY_BANK, accountNumber: "12345", rsaPin: "PIN123", tin: "abc" });
    assert.deepEqual(Object.keys(e).sort(), ["accountNumber", "bankName", "rsaPin", "tin"]);
  });

  it("validates personal details", () => {
    const p = { ...emptyRecord().personal, dateOfBirth: "2030-01-01", personalEmail: "nope", emergencyContacts: [{ name: "", relationship: "", phone: "0803", address: "" }] };
    const e = checkPersonal(p, "2026-10-12");
    assert.ok(e.dateOfBirth && e.personalEmail && e.emergency0);
    assert.ok(checkPersonal({ ...p, dateOfBirth: "2020-01-01", personalEmail: "", emergencyContacts: [] }, "2026-10-12").dateOfBirth, "under 15 flagged");
    assert.deepEqual(checkPersonal({ ...p, dateOfBirth: "1990-02-03", personalEmail: "a@b.co", emergencyContacts: [] }, "2026-10-12"), {});
  });

  it("masks numbers and works out age", () => {
    assert.equal(mask("0123456789"), "••••••6789");
    assert.equal(mask("PEN100200300400"), "••••••0400");
    assert.equal(mask(""), "");
    assert.equal(ageOn("1990-10-13", "2026-10-12"), 35);
    assert.equal(ageOn("1990-10-12", "2026-10-12"), 36);
  });

  it("cleans up stored data it doesn't recognise", () => {
    const p = normalisePersonal({ address: "  1 Road ", emergencyContacts: [1, 2, 3, 4, 5], education: "x", nationality: "" });
    assert.equal(p.address, "1 Road");
    assert.equal(p.emergencyContacts.length, 3);
    assert.deepEqual(p.education, []);
    assert.equal(p.nationality, "Nigerian");
  });

  it("updates personal, job and bank sections, refusing invalid data and duplicate staff IDs", () => {
    let s = createDemoData(NOW);
    const [a, b] = s.employees;
    s = run(s, { type: "employee/updatePersonal", employeeId: a.id, personal: { ...s.records[a.id].personal, address: "9 New Street" }, id: "p", at });
    assert.equal(s.records[a.id].personal.address, "9 New Street");
    assert.equal(run(s, { type: "employee/updatePersonal", employeeId: a.id, personal: { ...s.records[a.id].personal, dateOfBirth: "2099-01-01" }, id: "p2", at }), s);
    assert.equal(run(s, { type: "employee/updateJob", employeeId: a.id, job: { ...s.records[a.id].job, staffId: s.records[b.id].job.staffId.toLowerCase() }, id: "j", at }), s);
    s = run(s, { type: "employee/updateJob", employeeId: a.id, job: { ...s.records[a.id].job, grade: "Principal" }, id: "j2", at });
    assert.equal(s.records[a.id].job.grade, "Principal");
    assert.equal(run(s, { type: "employee/updateBank", employeeId: a.id, bank: { ...EMPTY_BANK, accountNumber: "1" }, id: "b", at }), s);
    s = run(s, { type: "employee/updateBank", employeeId: a.id, bank: { ...EMPTY_BANK, bankName: "Wema Bank", accountNumber: "0987654321" }, id: "b2", at });
    assert.equal(s.bank[a.id].accountNumber, "0987654321");
    assert.ok(!JSON.stringify(s.activity[0]).includes("0987654321"), "activity never carries the number");
  });

  it("lets anyone update their own personal details; only HR touches job and bank", () => {
    assert.ok(rolesFor("employee/updatePersonal").includes("employee"));
    assert.deepEqual(rolesFor("employee/updateJob"), ["hr_admin"]);
    assert.deepEqual(rolesFor("employee/updateBank"), ["hr_admin"]);
  });
});
