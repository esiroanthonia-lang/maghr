import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/ComingNext";
import { TeamManager, type Member, type PendingInvite } from "@/components/settings/TeamManager";
import { PageHeader } from "@/components/ui/bits";
import { demoMode, requireWorkspace } from "@/lib/server/session";
import { ROLES, type Role } from "@/lib/workspace";

export const metadata: Metadata = { title: "Settings" };

const asRole = (r: unknown): Role => ((ROLES as readonly string[]).includes(r as string) ? (r as Role) : "employee");

export default async function SettingsPage() {
  if (demoMode()) {
    return (
      <ComingNext
        title="Settings"
        eyebrow="YOUR WORKSPACE, YOUR RULES"
        intro="Manage company details, access, and preferences."
        planned={[
          "Team and roles (available now when connected to a database: see SETUP.md)",
          "Company and workspace details",
          "Leave policy and working week",
          "Integrations: MyJobMag, WhatsApp Business",
        ]}
      />
    );
  }
  const { supabase, info } = await requireWorkspace();
  const isAdmin = info.me.role === "hr_admin";
  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase.from("memberships").select("user_id, full_name, email, role").eq("org_id", info.orgId).order("created_at"),
    isAdmin
      ? supabase.from("invitations").select("id, email, role, created_at, expires_at").eq("org_id", info.orgId).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const members: Member[] = (memberRows ?? []).map((m) => ({ userId: String(m.user_id), name: String(m.full_name ?? ""), email: String(m.email ?? ""), role: asRole(m.role) }));
  const invites: PendingInvite[] = (inviteRows ?? []).map((i) => ({
    id: String(i.id),
    email: String(i.email),
    role: asRole(i.role),
    createdAt: String(i.created_at),
    expiresAt: String(i.expires_at),
  }));
  return (
    <>
      <PageHeader eyebrow="YOUR WORKSPACE, YOUR RULES" title="Settings" intro={`Team and access for ${info.orgName}.`} />
      <TeamManager members={members} invites={invites} meId={info.me.userId} isAdmin={isAdmin} />
    </>
  );
}
