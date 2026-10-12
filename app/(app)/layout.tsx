import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { loadState } from "@/lib/server/data";
import { demoMode, requireWorkspace } from "@/lib/server/session";

// Without Supabase settings the app runs as the synthetic demo.
// With them, every page here requires sign-in and shows the company's real data.
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (demoMode()) return <AppShell>{children}</AppShell>;
  const { supabase, info } = await requireWorkspace();
  const state = await loadState(supabase, info.orgId);
  return (
    <AppShell initialState={state} workspace={info}>
      {children}
    </AppShell>
  );
}
