"use client";

// Small presentational building blocks shared across pages.

import type { ReactNode } from "react";
import { formatDate, formatRelative, initials } from "@/lib/format";
import { useNow } from "@/lib/store";
import type { Stage } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

export function PageHeader({ eyebrow, title, intro, actions }: { eyebrow: ReactNode; title: ReactNode; intro: ReactNode; actions?: ReactNode }) {
  return (
    <div className="welcome">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </div>
  );
}

export type Tone = "orange" | "blue" | "green" | "purple";

export function StatCard({ label, value, foot, icon, tone = "orange", demo }: { label: string; value: ReactNode; foot: ReactNode; icon: IconName; tone?: Tone; demo?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-head">
        <span>
          {label}
          {demo ? <span className="demo-chip" title="Static demo figure">Demo</span> : null}
        </span>
        <span className={`stat-icon tone-${tone}`}>
          <Icon name={icon} size={17} />
        </span>
      </div>
      <div className="stat-num">{value}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

export function Panel({ title, subtitle, action, children, className, id }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${className ?? ""}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="panel-head">
        <div>
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`badge s-${stage.toLowerCase()}`}>{stage}</span>;
}

export function Badge({ tone, children }: { tone: "ok" | "bad" | "neutral" | "warn" | "info"; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span className={`person p${hash(name) % 5} ${large ? "lg" : ""}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  if (!value) return <span className="stat-foot">Not rated</span>;
  return (
    <span className="stars" role="img" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "" : "off"} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

/** Relative time ("2 hours ago"). Shows a plain date until the browser clock is available. */
export function RelativeTime({ iso }: { iso: string }) {
  const now = useNow();
  return <time dateTime={iso}>{now ? formatRelative(iso, now) : formatDate(iso)}</time>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={`notice ${tone === "warn" ? "warn" : ""}`}>
      <Icon name="info" size={16} />
      <div>{children}</div>
    </div>
  );
}
