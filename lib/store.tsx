"use client";

// App state. In demo mode it lives in memory and resets on refresh.
// In live mode every change is sent to the server (app/actions/workspace.ts), which re-applies
// the same reducer to the database copy and returns the saved state.

import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { persistAction } from "@/app/actions/workspace";
import { useToast } from "@/components/ui/Toast";
import { createDemoData } from "./demo-data";
import { recruitmentReducer, type RecruitmentAction, type RecruitmentState } from "./recruitment";
import { canEditRecruitment, type WorkspaceInfo } from "./workspace";

type ActionWithoutMeta = RecruitmentAction extends infer A
  ? A extends { type: "reset" }
    ? never
    : A extends unknown
      ? Omit<A, "id" | "at">
      : never
  : never;

interface StoreValue {
  state: RecruitmentState;
  /** Which workspace this is: the synthetic demo, or a real company signed in through Supabase. */
  workspace: WorkspaceInfo;
  /** True while a change is being saved to the database. */
  saving: boolean;
  /** Apply a change; id and timestamp are filled in automatically. Returns the generated id. */
  act: (action: ActionWithoutMeta) => string;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

let counter = 0;
/** New record ids. UUIDs, so the same id works in the demo and in the database. */
export function makeId(prefix = "id"): string {
  counter += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${counter}`;
}

const DEMO: WorkspaceInfo = { mode: "demo" };

export function DemoStoreProvider({
  children,
  initialState,
  workspace = DEMO,
}: {
  children: ReactNode;
  initialState?: RecruitmentState;
  workspace?: WorkspaceInfo;
}) {
  const [state, dispatch] = useReducer(recruitmentReducer, initialState, (init) => init ?? createDemoData());
  const toast = useToast();
  const [pending, setPending] = useState(0);
  const latest = useRef(0);
  const live = workspace.mode === "live";

  const act = useCallback(
    (action: ActionWithoutMeta) => {
      const id = makeId(action.type.split("/")[1] ?? "x");
      const full = { ...action, id, at: new Date().toISOString() } as RecruitmentAction;
      if (!live) {
        dispatch(full);
        return id;
      }
      if (action.type !== "inbox/setStatus" && !canEditRecruitment(workspace)) {
        toast("Your role can view recruitment but not change it.");
        return id;
      }
      // Show the change straight away, then replace it with what the database actually saved.
      dispatch(full);
      const ticket = ++latest.current;
      setPending((n) => n + 1);
      persistAction(full)
        .then((res) => {
          if (!res.ok) toast(res.error);
          const next = res.state;
          if (next && ticket === latest.current) dispatch({ type: "reset", state: next });
        })
        .catch(() => {
          toast("Couldn’t reach the server. Your last change may not be saved. Refresh to check.");
        })
        .finally(() => setPending((n) => n - 1));
      return id;
    },
    [live, workspace, toast],
  );

  const resetDemo = useCallback(() => {
    if (!live) dispatch({ type: "reset", state: createDemoData() });
  }, [live]);

  const value = useMemo(() => ({ state, workspace, saving: pending > 0, act, resetDemo }), [state, workspace, pending, act, resetDemo]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDemoStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useDemoStore must be used inside <DemoStoreProvider>");
  return ctx;
}

/**
 * Current time (to the minute), available only in the browser.
 * Returns null during server rendering and hydration so time-of-day text never
 * causes a hydration mismatch, then updates every minute.
 */
function subscribeToClock(onChange: () => void) {
  const t = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(t);
}
const currentMinute = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => null;

export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeToClock, currentMinute, serverMinute);
  return useMemo(() => (minute === null ? null : new Date(minute * 60_000)), [minute]);
}
