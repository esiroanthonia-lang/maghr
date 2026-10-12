"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MANAGE_NAV, WORKSPACE_NAV, type NavItem } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import { useDemoStore } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/workspace";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

function NavLink({ item, pathname, pill }: { item: NavItem; pathname: string; pill?: number }) {
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} title={item.label}>
      <span className="ico">
        <Icon name={item.icon} />
      </span>
      <span className="nav-text">{item.label}</span>
      {pill ? (
        <span className="pill" aria-label={`${pill} new applications`}>
          {pill}
        </span>
      ) : !item.ready ? (
        <span className="soon">Next</span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const { state, resetDemo, workspace } = useDemoStore();
  const live = workspace.mode === "live";
  // WhatsApp desk is a simulator until a WhatsApp Business account is connected.
  const workspaceNav = live ? WORKSPACE_NAV.filter((n) => n.href !== "/whatsapp") : WORKSPACE_NAV;
  const toast = useToast();
  const newApplications = state.candidates.filter((c) => c.stage === "Applied" && c.jobId).length;

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          M
        </div>
        <div className="brand-word">
          MagHR<small>BY MYJOBMAG</small>
        </div>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav" aria-label="Workspace">
        {workspaceNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} pill={item.href === "/recruitment" ? newApplications : undefined} />
        ))}
      </nav>
      <div className="nav-label">MANAGE</div>
      <nav className="nav" aria-label="Manage">
        {MANAGE_NAV.map((item) => (
          <NavLink key={item.href} item={live && item.href === "/settings" ? { ...item, ready: true } : item} pathname={pathname} />
        ))}
      </nav>
      {live ? (
        <div className="sidebar-bottom">
          <strong>{workspace.orgName}</strong>
          <br />
          {workspace.me.name} · {ROLE_LABELS[workspace.me.role]}
          <br />
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      ) : (
      <div className="sidebar-bottom">
        Your people. One place.
        <br />
        <strong>MagHR by MyJobMag</strong>
        <br />
        Prototype · Demo workspace
        <br />
        <button
          type="button"
          onClick={() => {
            resetDemo();
            toast("Demo data reset to its starting state.");
          }}
        >
          Reset demo data
        </button>
      </div>
      )}
    </aside>
  );
}
