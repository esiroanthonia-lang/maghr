// Unit tests for the public careers page logic. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { appReducer } from "../lib/app-reducer";
import { checkApplication, publicPageFromState, suggestSlug, validCareersSettings } from "../lib/careers";
import { createDemoData } from "../lib/demo-data";
import type { PeopleAction } from "../lib/people";
import { rolesFor } from "../lib/workspace";

const NOW = new Date("2026-10-12T13:00:00Z");
const at = NOW.toISOString();
const run = (s: ReturnType<typeof createDemoData>, a: PeopleAction) => appReducer(s, a);
const good = { name: "Ann Applicant", email: "ann@example.com", phone: "", location: "Lagos", years: 3, note: "", consent: true };

describe("careers page", () => {
  it("makes a tidy web address from a company name", () => {
    assert.equal(suggestSlug("MyJobMag Nigeria Ltd."), "myjobmag-nigeria-ltd");
    assert.equal(suggestSlug("  Ọ̀ṣun & Co  "), "osun-co");
  });

  it("accepts only safe web addresses, and needs one to go live", () => {
    assert.ok(validCareersSettings({ enabled: true, slug: "acme-ng", intro: "" }));
    assert.ok(!validCareersSettings({ enabled: true, slug: "", intro: "" }));
    assert.ok(validCareersSettings({ enabled: false, slug: "", intro: "" }));
    for (const bad of ["ab", "-acme", "acme-", "Acme", "acme ng", "a".repeat(41)]) assert.ok(!validCareersSettings({ enabled: true, slug: bad, intro: "" }), bad);
    assert.ok(!validCareersSettings({ enabled: true, slug: "acme", intro: "x".repeat(601) }));
  });

  it("shows visitors open jobs only, with no internal fields", () => {
    const s = createDemoData(NOW);
    const page = publicPageFromState(s);
    assert.equal(page.jobs.length, s.jobs.filter((j) => j.status === "Open").length);
    const text = JSON.stringify(page);
    for (const j of s.jobs.filter((j) => j.status !== "Open")) assert.ok(!text.includes(j.id), `non-open job ${j.title} exposed`);
    assert.ok(!/"owner"|"channels"|"candidates"|"pay"/.test(text));
  });

  it("checks applications and requires consent", () => {
    assert.deepEqual(checkApplication(good), {});
    const e = checkApplication({ ...good, name: "A", email: "nope", years: -1, consent: false, note: "x".repeat(1501) });
    assert.deepEqual(Object.keys(e).sort(), ["consent", "email", "name", "note", "years"]);
  });

  it("only HR admins change the careers page; changes are logged", () => {
    assert.deepEqual(rolesFor("settings/careers"), ["hr_admin"]);
    let s = createDemoData(NOW);
    s = run(s, { type: "settings/careers", careers: { enabled: false, slug: "myjobmag-demo", intro: "" }, id: "c1", at });
    assert.equal(s.careers.enabled, false);
    assert.equal(s.activity[0].title, "Careers page turned off");
    assert.equal(run(s, { type: "settings/careers", careers: { enabled: true, slug: "Bad Slug", intro: "" }, id: "c2", at }), s);
    s = run(s, { type: "settings/careers", careers: { enabled: true, slug: " Acme-NG ", intro: " Hi " }, id: "c3", at });
    assert.deepEqual(s.careers, { enabled: true, slug: "acme-ng", intro: "Hi" });
  });
});
