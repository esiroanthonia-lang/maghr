"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navFor, type NavItem } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import { useDemoStore } from "@/lib/store";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/workspace";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Logo";
import { useToast } from "../ui/Toast";

/** Short labels for the phone tab bar, where there is room for one word. */
const SHORT: Record<string, string> = { "My space": "Me", "People overview": "Home", Overview: "Home", "WhatsApp desk": "WhatsApp", "My performance": "Reviews" };
const shortLabel = (label: string) => {
  if (SHORT[label]) return SHORT[label];
  const s = label.replace(/^My /, "").split(" & ")[0];
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function NavLink({ item, pathname, pill }: { item: NavItem; pathname: string; pill?: number }) {
  const active = item.href === "/" ? pathname === "/" : pathname === item.href || (pathname.startsWith(item.href) && !(item.href === "/me" && pathname !== "/me"));
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} title={item.label}>
      <span className="ico">
        <Icon name={item.icon} />
      </span>
      <span className="nav-text">{item.label}</span>
      <span className="nav-short" aria-hidden="true">{shortLabel(item.label)}</span>
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
  const { state, resetDemo, workspace, role, setDemoRole } = useDemoStore();
  const live = workspace.mode === "live";
  const { workspace: workspaceNav, manage: manageNav } = navFor(role, live);
  const toast = useToast();
  const newApplications = state.candidates.filter((c) => c.stage === "Applied" && c.jobId).length;

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <Wordmark light />
      </div>
      <div className="nav-label">Workspace</div>
      <nav className="nav" aria-label="Workspace">
        {workspaceNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} pill={item.href === "/recruitment" ? newApplications : undefined} />
        ))}
      </nav>
      <div className="nav-label">Manage</div>
      <nav className="nav" aria-label="Manage">
        {manageNav.map((item) => (
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
        <strong>Membra by MyJobMag</strong>
        <br />
        Prototype · Demo workspace
        <br />
        <label className="view-as">
          View as
          <select value={role} onChange={(e) => setDemoRole(e.target.value as Role)} aria-label="View the demo as a role">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
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
