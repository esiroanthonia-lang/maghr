"use server";

// Public: anyone can apply for an open job. The database function validates again and rate-limits.

import { checkApplication, RESULT_MESSAGES, type ApplicationResult } from "@/lib/careers";
import { publicClient } from "@/lib/server/careers";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface ApplyState {
  status: "idle" | "sent" | "error";
  message: string;
  errors: Record<string, string>;
  demo?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitApplication(slug: string, jobId: string, _prev: ApplyState, form: FormData): Promise<ApplyState> {
  const text = (k: string) => String(form.get(k) ?? "").slice(0, 2000);
  // Hidden field that people never see; simple bots fill it in.
  if (text("website")) return { status: "sent", message: "", errors: {} };

  const input = {
    name: text("name").trim(),
    email: text("email").trim(),
    phone: text("phone").trim(),
    location: text("location").trim(),
    years: Number(text("years") || "0"),
    note: text("note").trim(),
    consent: form.get("consent") === "on",
  };
  const errors = checkApplication(input);
  if (Object.keys(errors).length) return { status: "error", message: "Please check the highlighted fields.", errors };

  if (!isSupabaseConfigured) {
    return { status: "sent", message: "", errors: {}, demo: true };
  }
  if (!UUID.test(jobId)) return { status: "error", message: RESULT_MESSAGES.closed, errors: {} };

  const { data, error } = await publicClient().rpc("submit_application", {
    p_slug: slug.toLowerCase(),
    p_job_id: jobId,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_location: input.location,
    p_years: input.years,
    p_note: input.note,
    p_consent: input.consent,
  });
  if (error) {
    console.error("submit_application failed", error.message);
    return { status: "error", message: RESULT_MESSAGES.error, errors: {} };
  }
  const result = (typeof data === "string" ? data : "error") as ApplicationResult;
  // A repeat application gets the same reply as a new one, so nobody can test whether an email has applied.
  if (result === "ok" || result === "duplicate") return { status: "sent", message: "", errors: {} };
  return { status: "error", message: RESULT_MESSAGES[result] ?? RESULT_MESSAGES.error, errors: {} };
}
