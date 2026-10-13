// Public careers page: shapes and validation shared by the page, the server action and tests.
// The database repeats every check (supabase/migrations/20261013000006_careers.sql).

import type { DemoState } from "./demo-data";

export interface CareersSettings {
  enabled: boolean;
  slug: string;
  intro: string;
}

export interface PublicJob {
  id: string;
  code: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  description: string;
  requirements: string[];
  postedAt: string;
}

export interface PublicCareersPage {
  company: string;
  intro: string;
  jobs: PublicJob[];
}

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** "MyJobMag Nigeria Ltd" → "myjobmag-nigeria-ltd" */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function validCareersSettings(c: CareersSettings): boolean {
  if (c.intro.length > 600) return false;
  if (c.slug && !SLUG_RE.test(c.slug)) return false;
  return !c.enabled || SLUG_RE.test(c.slug);
}

/** What visitors see: open jobs only, and none of the internal fields (owner, channels, candidates). */
export function publicPageFromState(state: DemoState): PublicCareersPage {
  return {
    company: state.settings.companyName,
    intro: state.careers.intro,
    jobs: state.jobs
      .filter((j) => j.status === "Open")
      .map((j) => ({
        id: j.id,
        code: j.code,
        title: j.title,
        department: j.department,
        location: j.location,
        employmentType: j.employmentType,
        description: j.description,
        requirements: j.requirements.map((r) => r.label),
        postedAt: j.createdAt,
      })),
  };
}

export interface ApplicationInput {
  name: string;
  email: string;
  phone: string;
  location: string;
  years: number;
  note: string;
  consent: boolean;
}

export type ApplicationResult = "ok" | "duplicate" | "closed" | "invalid" | "consent" | "busy" | "error";

/** Returns a field → message map; empty when the application can be sent. */
export function checkApplication(a: ApplicationInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (a.name.trim().length < 2 || a.name.trim().length > 120) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email.trim()) || a.email.length > 200) errors.email = "Enter an email address we can reach you on.";
  if (a.phone.length > 30) errors.phone = "That phone number is too long.";
  if (a.location.length > 80) errors.location = "Keep your location short, e.g. Lagos.";
  if (!Number.isInteger(a.years) || a.years < 0 || a.years > 60) errors.years = "Enter your years of experience as a number.";
  if (a.note.length > 1500) errors.note = "Keep your note under 1,500 characters.";
  if (!a.consent) errors.consent = "Please agree so we can process your application.";
  return errors;
}

export const RESULT_MESSAGES: Record<Exclude<ApplicationResult, "ok">, string> = {
  duplicate: "You’ve already applied for this role with that email. We have your application.",
  closed: "This role is no longer taking applications.",
  invalid: "Some details weren’t valid. Please check the form.",
  consent: "Please agree so we can process your application.",
  busy: "We’re receiving a lot of applications right now. Please try again in a few minutes.",
  error: "Something went wrong sending your application. Please try again.",
};
