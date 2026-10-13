"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { notificationsFor } from "@/lib/notifications";
import { useDemoStore, useNow } from "@/lib/store";
import { Icon } from "../ui/Icon";

// Which notifications this person has already seen, remembered in this browser only.
const KEY = "maghr-seen-notifications";
const EVENT = "maghr-seen-change";
const readSeen = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const subscribeSeen = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
function markSeen(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* private mode: badge just won't be remembered */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function Notifications() {
  const { state, workspace } = useDemoStore();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const seenRaw = useSyncExternalStore(subscribeSeen, readSeen, () => "");
  const seen = useMemo(() => {
    try {
      const v = JSON.parse(seenRaw || "[]");
      return new Set<string>(Array.isArray(v) ? v : []);
    } catch {
      return new Set<string>();
    }
  }, [seenRaw]);
  const items = useMemo(() => (now ? notificationsFor(state, workspace, now) : []), [state, workspace, now]);
  const unread = items.filter((n) => !seen.has(n.id)).length;
  // Items that were new when the panel was opened keep their dot until it closes.
  const [freshOnOpen, setFreshOnOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      setFreshOnOpen(new Set(items.filter((n) => !seen.has(n.id)).map((n) => n.id)));
      markSeen([...new Set([...seen, ...items.map((n) => n.id)])]);
    }
    setOpen(!open);
  }

  const label = unread ? `Notifications, ${unread} new` : "Notifications";
  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button ref={buttonRef} type="button" className="icon-button" onClick={toggle} aria-label={label} title="Notifications" aria-expanded={open} aria-controls={panelId}>
        <Icon name="bell" size={17} />
        {unread ? (
          <span className="notif-dot" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="notif-panel" id={panelId} role="region" aria-label="Notifications">
          <div className="notif-head">
            <h2>Needs your attention</h2>
          </div>
          {items.length ? (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className={freshOnOpen.has(n.id) ? "is-new" : ""}>
                  <Link href={n.href} onClick={() => setOpen(false)}>
                    <span className={`notif-icon tone-${n.tone}`} aria-hidden="true">
                      <Icon name={n.icon} size={15} />
                    </span>
                    <span style={{ minWidth: 0, margin: 0 }}>
                      <strong>{n.title}</strong>
                      <span>{n.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notif-empty">You’re all caught up.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
