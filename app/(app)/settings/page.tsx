import type { Metadata } from "next";
import { CareersPanel, CompanySettingsPanel, HolidaysPanel, PayrollRulesPanel, SettingsIntegrations } from "@/components/people/CompanySettings";
import { AppearancePanel } from "@/components/settings/AppearancePanel";
import { TeamManager, type ManagerAccessRequest, type Member, type PendingInvite } from "@/components/settings/TeamManager";
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
        <AppearancePanel />
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
  const [{ data: memberRows }, { data: inviteRows }, { data: accessRows }] = await Promise.all([
    supabase.from("memberships").select("user_id, full_name, email, role").eq("org_id", info.orgId).order("created_at"),
    isAdmin
      ? supabase.from("invitations").select("id, email, role, created_at, expires_at").eq("org_id", info.orgId).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    isAdmin
      ? supabase.from("manager_access_requests").select("id, user_id, employee_id, requested_at").eq("org_id", info.orgId).eq("status", "Pending").order("requested_at")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const { data: employeeRows } = isAdmin && accessRows?.length
    ? await supabase.from("employees").select("id, name, email, manager_name, status").eq("org_id", info.orgId)
    : { data: [] as Record<string, unknown>[] };
  const members: Member[] = (memberRows ?? []).map((m) => ({ userId: String(m.user_id), name: String(m.full_name ?? ""), email: String(m.email ?? ""), role: asRole(m.role) }));
  const invites: PendingInvite[] = (inviteRows ?? []).map((i) => ({
    id: String(i.id),
    email: String(i.email),
    role: asRole(i.role),
    createdAt: String(i.created_at),
    expiresAt: String(i.expires_at),
  }));
  const managerRequests: ManagerAccessRequest[] = (accessRows ?? []).map((request) => {
    const employee = (employeeRows ?? []).find((row) => String(row.id) === String(request.employee_id));
    const name = String(employee?.name ?? "");
    const directReports = name ? (employeeRows ?? []).filter((row) =>
      String(row.status) !== "Exited" && String(row.manager_name ?? "").trim().toLowerCase() === name.trim().toLowerCase()
    ).length : 0;
    return {
      id: String(request.id),
      employeeId: String(request.employee_id),
      name,
      email: String(employee?.email ?? ""),
      requestedAt: String(request.requested_at),
      directReports,
    };
  });
  return (
    <>
      <PageHeader eyebrow="YOUR WORKSPACE, YOUR RULES" title="Settings" intro={`Company details, team and access for ${info.orgName}.`} />
      <AppearancePanel />
      <CompanySettingsPanel />
      <HolidaysPanel />
      <PayrollRulesPanel />
      <CareersPanel />
      <TeamManager members={members} invites={invites} managerRequests={managerRequests} meId={info.me.userId} isAdmin={isAdmin} />
      <SettingsIntegrations />
    </>
  );
}
