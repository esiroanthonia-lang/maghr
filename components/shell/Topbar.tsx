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
  const { workspace, saving } = useDemoStore();
  const live = workspace.mode === "live";

  return (
    <header className="topbar">
      <div className="crumb">
        Workspace <span style={{ color: "#bdc6cc" }}> / </span> <strong>{pageTitle(pathname)}</strong>
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
          <div className="avatar" title="HR Admin (demo user)" aria-label="Signed in as HR Admin, demo user" role="img">
            HR
          </div>
        )}
      </div>
    </header>
  );
}
