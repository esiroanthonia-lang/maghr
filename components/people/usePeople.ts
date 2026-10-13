"use client";

import { useDemoStore, useNow } from "@/lib/store";
import { canPerform } from "@/lib/workspace";

/** Shared bits for the people pages: store, clock, and permission checks. */
export function usePeople() {
  const store = useDemoStore();
  const now = useNow();
  const can = (actionType: string) => canPerform(store.workspace, actionType);
  const isAdmin = store.workspace.mode === "demo" || store.workspace.me.role === "hr_admin";
  const todayIso = now ? now.toISOString().slice(0, 10) : null;
  const year = now ? now.getUTCFullYear() : null;
  return { ...store, now, can, isAdmin, todayIso, year };
}
