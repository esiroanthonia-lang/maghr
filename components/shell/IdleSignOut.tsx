"use client";

import { useEffect } from "react";
import { signOutIdle } from "@/app/actions/auth";
import { IDLE_LIMIT_MS } from "@/lib/session-timeout";

/** Signs out a tab that has been left alone, including after a laptop sleeps (the clock keeps running while asleep). */
export function IdleSignOut() {
  useEffect(() => {
    let last = Date.now();
    let done = false;
    const check = () => {
      if (done || Date.now() - last < IDLE_LIMIT_MS) return;
      done = true;
      void signOutIdle();
    };
    const touch = () => {
      // Waking up after a long gap isn't activity: check first, so an expired tab can't be revived by a mouse nudge.
      check();
      if (!done) last = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
