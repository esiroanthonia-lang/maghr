import type { Metadata } from "next";
import { CareersPanel, CompanySettingsPanel, HolidaysPanel, PayrollRulesPanel, SettingsIntegrations } from "@/components/people/CompanySettings";
import { TeamManager, type Member, type PendingInvite } from "@/components/settings/TeamManager";
import { PageHeader, Panel } from "@/components/ui/bits";
import { demoMode, requireWorkspace } from "@/lib/server/session";
import { ROLES, type Role } from "@/lib/workspace";

export const metadata: Metadata = { title: "Settings" };

const asRole = (r: unknown): Role => ((ROLES as readonly string[]).includes(r as string) ? (r as Role) : "employee");

export default async function SettingsPage() {
  if (demoMode()) {
    return (
      <>
        <PageHeader eyebrow="YOUR WORKSPACE, YOUR RULES" title="Settings" intro="Company details, leave policy, team and integrations." />
        <CompanySettingsPanel />
        <HolidaysPanel />
        <PayrollRulesPanel />
        <CareersPanel />
        <Panel title="Team & roles" subtitle="Available when connected to a database">
          <p className="panel-body" style={{ margin: 0, fontSize: 13 }}>
            Invite teammates as HR admin, recruiter, manager or employee once sign-in is switched on. See SETUP.md.
          </p>
        </Panel>
        <SettingsIntegrations />
      </>
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
      <PageHeader eyebrow="YOUR WORKSPACE, YOUR RULES" title="Settings" intro={`Company details, team and access for ${info.orgName}.`} />
      <CompanySettingsPanel />
      <HolidaysPanel />
      <PayrollRulesPanel />
      <CareersPanel />
      <TeamManager members={members} invites={invites} meId={info.me.userId} isAdmin={isAdmin} />
      <SettingsIntegrations />
    </>
  );
}
