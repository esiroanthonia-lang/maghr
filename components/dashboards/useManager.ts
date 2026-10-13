"use client";

import { teamOf } from "@/lib/dashboard";
import { myEmployeeEmail } from "@/lib/workspace";
import { useDemoStore } from "@/lib/store";

/** The signed-in manager's own employee record and the people who report to them. */
export function useManager() {
  const { state, workspace, role } = useDemoStore();
  const email = myEmployeeEmail(workspace, role);
  const me = state.employees.find((e) => e.email.toLowerCase() === email);
  const team = me ? teamOf(state, me.name) : [];
  return { state, me, team, ids: new Set(team.map((t) => t.id)) };
}
