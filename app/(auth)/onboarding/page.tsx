import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompanyForm } from "@/components/auth/AuthForms";
import { NotConfigured } from "@/components/auth/NotConfigured";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: existing } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing) redirect("/");
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return (
    <>
      <h1>Set up your workspace</h1>
      <p className="auth-lead">Create a private workspace for your company. Only people you invite can see its data.</p>
      <CompanyForm defaultName={name} />
      <p className="auth-alt">Been invited by your company? Open the invitation link from your HR admin instead.</p>
    </>
  );
}
