import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/AuthForms";
import { NotConfigured } from "@/components/auth/NotConfigured";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  return (
    <>
      <h1>Choose a new password</h1>
      <p className="auth-lead">Pick something you don’t use anywhere else.</p>
      <NewPasswordForm />
    </>
  );
}
