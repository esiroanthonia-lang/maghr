"use client";

/** Catches a page that fails to load, so people get a way forward instead of a blank screen. */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty">
      <strong>This page didn’t load</strong>
      Check your connection, then try again. Your saved work is safe.
      <div>
        <button type="button" className="btn primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
