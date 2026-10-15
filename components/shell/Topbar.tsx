"use client";

import { usePathname } from "next/navigation";
import { pageTitle } from "@/lib/nav";
import { DEMO_PERSONAS } from "@/lib/roles";
import { useDemoStore } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/workspace";
import { AccountMenu } from "./AccountMenu";
import { GlobalSearch } from "./GlobalSearch";
import { Notifications } from "./Notifications";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar() {
  const pathname = usePathname() ?? "/";
  const { workspace, saving, role, state } = useDemoStore();
  const persona = state.employees.find((e) => e.email.toLowerCase() === DEMO_PERSONAS[role]);
  const live = workspace.mode === "live";

  return (
    <header className="topbar">
      <div className="crumb">
        Workspace <span className="crumb-sep">/</span> <strong>{pageTitle(pathname, role)}</strong>
      </div>
      <div className="top-actions">
        <GlobalSearch />
        <ThemeToggle />
        <Notifications />
        {saving ? <span className="saving-dot" role="status">Saving…</span> : null}
        {live ? (
          <>
            <div className="user-chip">
              <strong>{workspace.me.name}</strong>
              <span>{ROLE_LABELS[workspace.me.role]}</span>
            </div>
            <AccountMenu name={workspace.me.name} roleLabel={ROLE_LABELS[workspace.me.role]} role={workspace.me.role} live />
          </>
        ) : (
          <AccountMenu name={persona?.name ?? "Demo user"} roleLabel={`${ROLE_LABELS[role]} (demo)`} role={role} live={false} />
        )}
      </div>
    </header>
  );
}
