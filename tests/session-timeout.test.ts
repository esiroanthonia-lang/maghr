// Session timeout rules. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { IDLE_LIMIT_MS, SESSION_LIMIT_MS, sessionExpired, shouldTouch } from "../lib/session-timeout";

const NOW = Date.parse("2026-10-15T08:00:00Z");

describe("session timeout", () => {
  it("keeps an active session", () => {
    assert.equal(sessionExpired(NOW - 60_000, NOW - 3_600_000, NOW), false);
  });
  it("ends a session left idle past the limit, e.g. a laptop switched off for 8 hours", () => {
    assert.equal(sessionExpired(NOW - 8 * 3_600_000, NOW - 9 * 3_600_000, NOW), true);
    assert.equal(sessionExpired(NOW - IDLE_LIMIT_MS - 1, NOW - 3_600_000, NOW), true);
    assert.equal(sessionExpired(NOW - IDLE_LIMIT_MS + 1000, NOW - 3_600_000, NOW), false);
  });
  it("ends a session that has lasted too long even if the person is active", () => {
    assert.equal(sessionExpired(NOW - 1000, NOW - SESSION_LIMIT_MS - 1, NOW), true);
  });
  it("treats missing or garbled times as a session that has just started", () => {
    assert.equal(sessionExpired(undefined, undefined, NOW), false);
    assert.equal(sessionExpired("abc", "", NOW), false);
  });
  it("refreshes the last-active time at most once a minute", () => {
    assert.equal(shouldTouch(undefined, NOW), true);
    assert.equal(shouldTouch(NOW - 10_000, NOW), false);
    assert.equal(shouldTouch(NOW - 61_000, NOW), true);
  });
});
