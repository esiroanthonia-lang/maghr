import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicPageFromState, type PublicCareersPage, type PublicJob } from "../careers";
import { createDemoData } from "../demo-data";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "../supabase/config";

/**
 * A visitor's view of the database: the public (publishable) key with no session, so it can only
 * call the two careers functions. Never use a secret/service key here.
 */
export function publicClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function toJob(raw: unknown): PublicJob | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  if (!str(j.id) || !str(j.title)) return null;
  return {
    id: str(j.id),
    code: str(j.code),
    title: str(j.title),
    department: str(j.department),
    location: str(j.location),
    employmentType: str(j.employmentType),
    description: str(j.description),
    requirements: Array.isArray(j.requirements) ? j.requirements.filter((r): r is string => typeof r === "string") : [],
    postedAt: str(j.postedAt),
  };
}

/** The public careers page for a company, or null if it doesn't exist or is switched off. */
export async function getCareersPage(slug: string): Promise<PublicCareersPage | null> {
  const clean = slug.toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(clean)) return null;
  if (!isSupabaseConfigured) {
    const demo = createDemoData();
    return demo.careers.enabled && demo.careers.slug === clean ? publicPageFromState(demo) : null;
  }
  const { data, error } = await publicClient().rpc("careers_page", { p_slug: clean });
  if (error) {
    // Not set up yet (migration not run): behave as if the page doesn't exist.
    if (/does not exist|schema cache|PGRST202|42883/i.test(`${error.code} ${error.message}`)) return null;
    throw new Error(error.message);
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return {
    company: str(d.company),
    intro: str(d.intro),
    jobs: (Array.isArray(d.jobs) ? d.jobs : []).map(toJob).filter((j): j is PublicJob => j !== null),
  };
}
