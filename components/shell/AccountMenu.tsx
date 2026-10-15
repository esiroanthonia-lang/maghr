"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { initials } from "@/lib/format";
import { canOpen } from "@/lib/roles";
import type { Role } from "@/lib/workspace";

/** The avatar opens a small menu: your profile, settings and sign out. Works the same on phones. */
export function AccountMenu({ name, roleLabel, role, live, title }: { name: string; roleLabel: string; role: Role; live: boolean; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links: [string, string][] = [
    ["/me/profile", "My profile"],
    ["/me", "My space"],
    ["/me/payslips", "My payslips"],
    ["/settings", "Settings"],
  ];

  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${name}`} title={title} onClick={() => setOpen((v) => !v)}>
        {initials(name)}
      </button>
      {open ? (
        <div className="account-panel" role="menu">
          <div className="account-who">
            <strong>{name}</strong>
            <span>{roleLabel}</span>
          </div>
          {links
            .filter(([href]) => canOpen(role, href))
            .map(([href, label]) => (
              <Link key={href} href={href} role="menuitem" className="account-item" onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
          {live ? (
            <form action={signOut}>
              <button type="submit" role="menuitem" className="account-item account-signout">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
