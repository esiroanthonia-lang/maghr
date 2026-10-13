"use client";

// App state. In demo mode it lives in memory and resets on refresh.
// In live mode every change is sent to the server (app/actions/workspace.ts), which re-applies
// the same reducer to the database copy and returns the saved state.

import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { persistAction } from "@/app/actions/workspace";
import { useToast } from "@/components/ui/Toast";
import { createDemoData } from "./demo-data";
import { appReducer, type AppAction as RecruitmentAction, type AppState as RecruitmentState } from "./app-reducer";
import { canPerform, type Role, type WorkspaceInfo } from "./workspace";

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
  /** The role the screens are built for: the signed-in role, or in the demo whichever role is being tried. */
  role: Role;
  /** Demo only: try the app as another role. */
  setDemoRole: (role: Role) => void;
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
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => init ?? createDemoData());
  const toast = useToast();
  const [pending, setPending] = useState(0);
  const latest = useRef(0);
  const live = workspace.mode === "live";
  const [demoRole, setDemoRole] = useState<Role>("hr_admin");
  const role: Role = workspace.mode === "live" ? workspace.me.role : demoRole;

  const act = useCallback(
    (action: ActionWithoutMeta) => {
      const id = makeId(action.type.split("/")[1] ?? "x");
      const full = { ...action, id, at: new Date().toISOString() } as RecruitmentAction;
      if (!canPerform(workspace, action.type, demoRole)) {
        toast("Your role can view this but not change it. Ask an HR admin.");
        return id;
      }
      if (!live) {
        dispatch(full);
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
    [live, workspace, demoRole, toast],
  );

  const resetDemo = useCallback(() => {
    if (!live) dispatch({ type: "reset", state: createDemoData() });
  }, [live]);

  const value = useMemo(() => ({ state, workspace, role, setDemoRole, saving: pending > 0, act, resetDemo }), [state, workspace, role, pending, act, resetDemo]);
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
