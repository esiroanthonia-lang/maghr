"use client";

import { usePathname } from "next/navigation";
import { pageTitle } from "@/lib/nav";
import { upcomingInterviews } from "@/lib/recruitment";
import { initials } from "@/lib/format";
import { useDemoStore, useNow } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/workspace";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar() {
  const pathname = usePathname() ?? "/";
  const { state, workspace, saving } = useDemoStore();
  const live = workspace.mode === "live";
  const now = useNow();
  const toast = useToast();

  function notify() {
    const count = now ? upcomingInterviews(state, now).length : 0;
    const fresh = state.candidates.filter((c) => c.stage === "Applied" && c.jobId).length;
    toast(`${fresh} new application${fresh === 1 ? "" : "s"} to review and ${count} upcoming interview${count === 1 ? "" : "s"}.`);
  }

  return (
    <header className="topbar">
      <div className="crumb">
        Workspace <span style={{ color: "#bdc6cc" }}> / </span> <strong>{pageTitle(pathname)}</strong>
      </div>
      <div className="top-actions">
        <GlobalSearch />
        <ThemeToggle />
        <button type="button" className="icon-button" onClick={notify} aria-label="Notifications" title="Notifications">
          <Icon name="bell" size={17} />
        </button>
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
