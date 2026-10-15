// When a signed-in session ends on its own. HR data is sensitive, so a laptop left open or switched off
// overnight must not still be signed in the next morning.

/** Signed out after this long with no activity. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
/** Signed out this long after signing in, however active the person is. */
export const SESSION_LIMIT_MS = 12 * 60 * 60 * 1000;
/** How often the "last active" time is refreshed on the server, so every request isn't a cookie write. */
export const TOUCH_EVERY_MS = 60 * 1000;

export const ACTIVE_COOKIE = "membra_active";
export const STARTED_COOKIE = "membra_started";

const asTime = (v: string | number | undefined | null): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** True when the session has been idle too long or has simply lasted too long. Missing times count as just started. */
export function sessionExpired(lastActive: string | number | undefined | null, startedAt: string | number | undefined | null, now: number): boolean {
  const last = asTime(lastActive);
  const started = asTime(startedAt);
  if (last !== null && now - last > IDLE_LIMIT_MS) return true;
  if (started !== null && now - started > SESSION_LIMIT_MS) return true;
  return false;
}

/** Whether the server should write a fresh "last active" time. */
export function shouldTouch(lastActive: string | number | undefined | null, now: number): boolean {
  const last = asTime(lastActive);
  return last === null || now - last >= TOUCH_EVERY_MS;
}
