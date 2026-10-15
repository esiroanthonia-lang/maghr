"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/session";
import { ROLES, type Role } from "@/lib/workspace";

export type TeamResult = { ok: true; link?: string } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function adminSession() {
  const s = await requireWorkspace();
  if (s.info.me.role !== "hr_admin") throw new Error("forbidden");
  return s;
}

async function origin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function guard(e: unknown): TeamResult {
  return { ok: false, error: e instanceof Error && e.message === "forbidden" ? "Only HR admins can manage the team." : "Something went wrong. Please try again." };
}

export async function inviteMember(email: string, role: Role): Promise<TeamResult> {
  try {
    const { supabase, info } = await adminSession();
    const clean = String(email).trim().toLowerCase();
    if (!EMAIL.test(clean)) return { ok: false, error: "Enter a valid email address." };
    if (!ROLES.includes(role)) return { ok: false, error: "Choose a role." };
    const { data, error } = await supabase.from("invitations").insert({ org_id: info.orgId, email: clean, role }).select("token").single();
    if (error || !data) return { ok: false, error: "Couldn’t create the invitation." };
    revalidatePath("/settings");
    return { ok: true, link: `${await origin()}/invite/${data.token}` };
  } catch (e) {
    return guard(e);
  }
}

export async function revokeInvite(id: string): Promise<TeamResult> {
  try {
    const { supabase, info } = await adminSession();
    const { error } = await supabase.from("invitations").delete().eq("id", id).eq("org_id", info.orgId).is("accepted_at", null);
    if (error) return { ok: false, error: "Couldn’t revoke the invitation." };
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return guard(e);
  }
}

export async function changeRole(userId: string, role: Role): Promise<TeamResult> {
  try {
    const { supabase, info } = await adminSession();
    if (userId === info.me.userId) return { ok: false, error: "You can’t change your own role. Ask another HR admin." };
    if (!ROLES.includes(role)) return { ok: false, error: "Choose a role." };
    const { error } = await supabase.from("memberships").update({ role }).eq("org_id", info.orgId).eq("user_id", userId);
    if (error) return { ok: false, error: "Couldn’t change the role." };
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return guard(e);
  }
}

export async function requestManagerAccess(): Promise<TeamResult> {
  try {
    const { supabase, info } = await requireWorkspace();
    if (info.me.role === "hr_admin") return { ok: false, error: "HR admins already have performance access." };

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, name")
      .eq("org_id", info.orgId)
      .eq("email", info.me.email)
      .maybeSingle();
    if (employeeError || !employee) return { ok: false, error: "Ask HR to link your work email to your employee profile first." };

    const { data: employees, error: reportsError } = await supabase
      .from("employees")
      .select("manager_name, status")
      .eq("org_id", info.orgId);
    if (reportsError) return { ok: false, error: "Couldn’t check your assigned reports." };
    const hasReports = (employees ?? []).some((report) =>
      report.status !== "Exited" && report.manager_name.trim().toLowerCase() === String(employee.name).trim().toLowerCase()
    );
    if (!hasReports) return { ok: false, error: "Ask HR to assign at least one employee to you as their manager before requesting access." };

    const { data: pending } = await supabase
      .from("manager_access_requests")
      .select("id")
      .eq("org_id", info.orgId)
      .eq("user_id", info.me.userId)
      .eq("status", "Pending")
      .maybeSingle();
    if (pending) return { ok: true };

    const { error } = await supabase.from("manager_access_requests").insert({
      org_id: info.orgId,
      user_id: info.me.userId,
      employee_id: employee.id,
    });
    if (error) return { ok: false, error: "Couldn’t send the request. Please try again or ask HR to update your role." };
    revalidatePath("/settings");
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function decideManagerAccessRequest(requestId: string, approve: boolean): Promise<TeamResult> {
  try {
    const { supabase, info } = await adminSession();
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: "That request wasn’t found." };
    const { error } = await supabase.rpc("decide_manager_access_request", {
      p_org_id: info.orgId,
      p_request_id: requestId,
      p_approve: approve,
    });
    if (error) return { ok: false, error: "Couldn’t update manager access. Make sure the person still has direct reports assigned." };
    revalidatePath("/settings");
    revalidatePath("/performance");
    return { ok: true };
  } catch (e) {
    return guard(e);
  }
}

export async function removeMember(userId: string): Promise<TeamResult> {
  try {
    const { supabase, info } = await adminSession();
    if (userId === info.me.userId) return { ok: false, error: "You can’t remove yourself." };
    const { error } = await supabase.from("memberships").delete().eq("org_id", info.orgId).eq("user_id", userId);
    if (error) return { ok: false, error: "Couldn’t remove that person." };
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return guard(e);
  }
}
