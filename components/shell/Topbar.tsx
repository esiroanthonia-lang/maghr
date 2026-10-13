"use client";

import { usePathname } from "next/navigation";
import { pageTitle } from "@/lib/nav";
import { initials } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/workspace";
import { GlobalSearch } from "./GlobalSearch";
import { Notifications } from "./Notifications";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar() {
  const pathname = usePathname() ?? "/";
  const { workspace, saving, role } = useDemoStore();
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
            <div className="avatar" aria-hidden="true">
              {initials(workspace.me.name)}
            </div>
          </>
        ) : (
          <div className="avatar" title={`${ROLE_LABELS[role]} (demo user)`} aria-label={`Viewing the demo as ${ROLE_LABELS[role]}`} role="img">
            {role === "hr_admin" ? "HR" : ROLE_LABELS[role].slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
