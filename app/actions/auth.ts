"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  message?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function field(form: FormData, name: string, max = 200): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Only allow redirects to paths inside this app. */
function safeNext(v: string): string {
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function notConfigured(): FormState {
  return { error: "Sign-in isn’t set up yet. Add the Supabase settings described in SETUP.md." };
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const email = field(form, "email");
  const password = field(form, "password", 200);
  if (!EMAIL.test(email) || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Same message for unknown email and wrong password, so the form doesn't reveal who has an account.
  if (error) return { error: /confirm/i.test(error.message) ? "Please confirm your email first. Check your inbox for the link." : "Email or password is incorrect." };
  redirect(safeNext(field(form, "next", 500)));
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const name = field(form, "name", 120);
  const email = field(form, "email");
  const password = field(form, "password", 200);
  if (name.length < 2) return { error: "Enter your full name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  const next = safeNext(field(form, "next", 500));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next === "/" ? "/onboarding" : next)}`,
    },
  });
  if (error) return { error: /registered|exists/i.test(error.message) ? "An account with that email already exists. Try signing in." : "Couldn’t create the account. Please try again." };
  if (data.session) redirect(next === "/" ? "/onboarding" : next); // email confirmation is switched off
  return { message: `Check ${email} for a confirmation link to finish creating your account.` };
}

/** Emails a reset link. Always says the same thing, so the form doesn't reveal who has an account. */
export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const email = field(form, "email").toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password` });
  return { message: `If ${email} has a Membra account, a reset link is on its way. It works once and expires after an hour.` };
}

/** Sets a new password for the person signed in through a reset link. */
export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const password = field(form, "password", 200);
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  if (password !== field(form, "confirm", 200)) return { error: "The two passwords don’t match." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Ask for a new one from the sign-in page." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: /different|same/i.test(error.message) ? "Choose a password you haven’t used before." : "Couldn’t save the new password. Please try again." };
  redirect("/");
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

/** Signs out someone who was away too long, and says why on the sign-in page. */
export async function signOutIdle() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login?expired=1");
}

export async function createCompany(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const company = field(form, "company", 120);
  const name = field(form, "name", 120);
  if (company.length < 2) return { error: "Enter your company name." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { p_name: company, p_full_name: name });
  if (error) {
    if (/already belong/i.test(error.message)) redirect("/");
    return { error: "Couldn’t create the workspace. Please try again." };
  }
  redirect("/");
}

export async function acceptInvite(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const token = field(form, "token", 200);
  const name = field(form, "name", 120);
  if (!/^[0-9a-f]{48}$/.test(token)) return { error: "This invitation link isn’t valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token, p_full_name: name });
  if (error) {
    if (/different email/i.test(error.message)) return { error: "This invitation was sent to a different email address. Sign in with that email instead." };
    return { error: "This invitation is invalid or has expired. Ask your HR admin for a new link." };
  }
  redirect("/");
}
