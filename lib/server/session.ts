import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "../supabase/config";
import { createClient } from "../supabase/server";
import { ROLES, type Role, type WorkspaceInfo } from "../workspace";

export interface LiveSession {
  supabase: Awaited<ReturnType<typeof createClient>>;
  info: Extract<WorkspaceInfo, { mode: "live" }>;
}

/**
 * The signed-in user and their workspace. Redirects to /login or /onboarding when needed.
 * Cached per request so layouts and pages share one lookup.
 */
export const requireWorkspace = cache(async (): Promise<LiveSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("org_id, role, full_name, email, organizations(name)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!membership) redirect("/onboarding");

  const role = (ROLES as readonly string[]).includes(membership.role) ? (membership.role as Role) : "employee";
  const org = membership.organizations as unknown as { name?: string } | null;
  return {
    supabase,
    info: {
      mode: "live",
      orgId: membership.org_id as string,
      orgName: org?.name ?? "Your company",
      me: {
        userId: user.id,
        name: (membership.full_name as string) || user.email || "You",
        email: user.email ?? "",
        role,
      },
    },
  };
});

export function demoMode(): boolean {
  return !isSupabaseConfigured;
}
