"use server";

// Server actions that save recruitment changes for the signed-in user's company.

import { randomUUID } from "node:crypto";
import type { DemoState } from "@/lib/demo-data";
import { appReducer, type AppAction as RecruitmentAction } from "@/lib/app-reducer";
import { isUuid, loadState, writeChanges } from "@/lib/server/data";
import { requireWorkspace } from "@/lib/server/session";
import { rolesFor } from "@/lib/workspace";

export type PersistResult = { ok: true; state: DemoState } | { ok: false; error: string; state?: DemoState };

// Actions the browser may send. Demo-only features (CV database, WhatsApp simulator) are not accepted.
const ALLOWED = new Set<RecruitmentAction["type"]>([
  "job/add",
  "job/setStatus",
  "job/publish",
  "candidate/add",
  "candidate/moveStage",
  "candidate/rate",
  "candidate/addNote",
  "candidate/setCvStatus",
  "candidate/scheduleInterview",
  "candidate/setInterviewStatus",
  "candidate/setOfferStatus",
  "candidate/setTalentPool",
  "candidate/convertToEmployee",
  "candidate/assignToJob",
  "candidate/reviewRequirement",
  "inbox/setStatus",
  "employee/add",
  "employee/update",
  "employee/setPay",
  "employee/exit",
  "employee/setRent",
  "employee/updatePersonal",
  "employee/updateJob",
  "employee/updateBank",
  "leave/request",
  "leave/decide",
  "leave/cancel",
  "goal/add",
  "goal/progress",
  "review/set",
  "review/selfAppraise",
  "payroll/create",
  "payroll/submit",
  "payroll/approve",
  "payroll/reopen",
  "settings/update",
  "settings/addHoliday",
  "settings/removeHoliday",
  "settings/careers",
  "settings/payroll",
  "onboarding/start",
  "onboarding/add",
  "onboarding/toggle",
  "onboarding/remove",
  "attendance/clockIn",
  "attendance/clockOut",
  "attendance/correct",
]);

function friendly(message: string): string {
  if (/row-level security|permission denied|42501/i.test(message)) return "You don’t have permission to make that change.";
  if (/careers_slug/i.test(message) && /duplicate key|unique/i.test(message)) return "Another company already uses that web address. Try a different one.";
  if (/duplicate key|unique/i.test(message)) return "That conflicts with an existing record (for example a job code or email). Refresh and try again.";
  if (/does not exist|schema cache|PGRST205|42P01/i.test(message)) return "This needs the latest database update. Ask your admin to run the newest file in supabase/migrations.";
  if (/check constraint|violates check/i.test(message)) return "Some details weren’t valid. Please check the form and try again.";
  return "Couldn’t save that change. Please try again.";
}

export async function persistAction(raw: unknown): Promise<PersistResult> {
  const { supabase, info } = await requireWorkspace();
  if (!raw || typeof raw !== "object" || !ALLOWED.has((raw as { type: RecruitmentAction["type"] }).type)) {
    return { ok: false, error: "That action isn’t supported." };
  }
  if (!rolesFor((raw as { type: string }).type).includes(info.me.role)) {
    return { ok: false, error: "Your role can view this but not change it. Ask an HR admin." };
  }
  if (JSON.stringify(raw).length > 20_000) return { ok: false, error: "That request is too large." };

  const input = raw as RecruitmentAction & { id?: unknown };
  // The server decides the time and the person; the browser's values are ignored.
  const action = {
    ...input,
    id: isUuid(input.id) ? input.id : randomUUID(),
    at: new Date().toISOString(),
    by: info.me.name,
  } as RecruitmentAction;

  try {
    const before = await loadState(supabase, info.orgId);
    // Managers may only create goals for, update goals owned by, and review their own direct reports.
    if (info.me.role === "manager") {
      const manager = before.employees.find((employee) => employee.email.trim().toLowerCase() === info.me.email.trim().toLowerCase());
      const managerName = manager?.name.trim().toLowerCase();
      const managesEmployee = (employeeId: string) => Boolean(managerName && before.employees.some((employee) =>
        employee.id === employeeId && employee.managerName.trim().toLowerCase() === managerName
      ));
      if (!managerName && (action.type === "review/set" || action.type === "goal/progress" || action.type === "goal/add")) {
        return { ok: false, error: "Your employee profile must be linked before you can manage reviews or goals." };
      }
      if (action.type === "review/set" && !managesEmployee(action.employeeId)) {
        return { ok: false, error: "You can only review your direct reports." };
      }
      if (action.type === "goal/add" && !before.employees.some((employee) =>
        employee.managerName.trim().toLowerCase() === managerName && employee.name.trim().toLowerCase() === action.input.ownerName.trim().toLowerCase()
      )) {
        return { ok: false, error: "You can only create goals for your direct reports." };
      }
      if (action.type === "goal/progress") {
        const goal = before.goals.find((item) => item.id === action.goalId);
        const ownedByReport = goal && before.employees.some((employee) =>
          employee.managerName.trim().toLowerCase() === managerName && employee.name.trim().toLowerCase() === goal.ownerName.trim().toLowerCase()
        );
        if (!ownedByReport) return { ok: false, error: "You can only update goals owned by your direct reports." };
      }
    }
    if (action.type === "review/selfAppraise") {
      const mine = before.employees.find((e) => e.email.toLowerCase() === info.me.email.toLowerCase());
      const review = before.reviews.find((r) => r.employeeId === action.employeeId && r.cycle === action.cycle);
      const selfAppraisal = action.selfAppraisal.trim();
      if (info.me.role !== "employee" || !mine || action.employeeId !== mine.id) {
        return { ok: false, error: "You can only submit your own self-appraisal." };
      }
      if (!review || review.status !== "Self review") {
        return { ok: false, error: "Your manager has not opened the self-appraisal step for this review." };
      }
      if (selfAppraisal.length < 10 || selfAppraisal.length > 3000) {
        return { ok: false, error: "Write between 10 and 3,000 characters before submitting." };
      }
      const { error } = await supabase.rpc("submit_self_appraisal", {
        p_employee_id: action.employeeId,
        p_cycle: action.cycle,
        p_appraisal: selfAppraisal,
      });
      if (error) throw error;
      return { ok: true, state: await loadState(supabase, info.orgId) };
    }
    // People who aren't HR admins or managers may only request/cancel their OWN leave.
    if ((action.type === "leave/request" || action.type === "leave/cancel") && !["hr_admin", "manager"].includes(info.me.role)) {
      const mine = before.employees.find((e) => e.email.toLowerCase() === info.me.email.toLowerCase());
      const targetId =
        action.type === "leave/request" ? action.input.employeeId : before.leave.find((l) => l.id === action.leaveId)?.employeeId;
      if (!mine || targetId !== mine.id) return { ok: false, error: "You can only manage your own leave." };
    }
    // Only HR admins edit other people's personal details.
    if (action.type === "employee/updatePersonal" && info.me.role !== "hr_admin") {
      const mine = before.employees.find((e) => e.email.toLowerCase() === info.me.email.toLowerCase());
      if (!mine || action.employeeId !== mine.id) return { ok: false, error: "You can only update your own details." };
    }
    // Outside HR and managers, people may only tick their own "New hire" onboarding steps.
    if (action.type === "onboarding/toggle" && !["hr_admin", "manager"].includes(info.me.role)) {
      const mine = before.employees.find((e) => e.email.toLowerCase() === info.me.email.toLowerCase());
      const task = before.onboarding.find((t) => t.id === action.taskId);
      if (!mine || !task || task.employeeId !== mine.id || task.owner !== "New hire") return { ok: false, error: "You can only tick off your own onboarding steps." };
    }
    // Everyone, HR included, clocks in and out only for themselves. HR fixes mistakes with a correction.
    if (action.type === "attendance/clockIn" || action.type === "attendance/clockOut") {
      const mine = before.employees.find((e) => e.email.toLowerCase() === info.me.email.toLowerCase());
      const targetId = action.type === "attendance/clockIn" ? action.employeeId : before.attendance.find((r) => r.id === action.recordId)?.employeeId;
      if (!mine || targetId !== mine.id) return { ok: false, error: "You can only clock yourself in and out." };
    }
    const after = appReducer(before, action);
    if (after !== before) await writeChanges(supabase, info.orgId, before, after);
    return { ok: true, state: await loadState(supabase, info.orgId) };
  } catch (e) {
    console.error("persistAction failed", action.type, e);
    let state: DemoState | undefined;
    try {
      state = await loadState(supabase, info.orgId);
    } catch {
      state = undefined;
    }
    return { ok: false, error: friendly(e instanceof Error ? e.message : String(e)), state };
  }
}

export async function reloadWorkspace(): Promise<DemoState> {
  const { supabase, info } = await requireWorkspace();
  return loadState(supabase, info.orgId);
}
