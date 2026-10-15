import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { NotConfigured } from "@/components/auth/NotConfigured";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  return (
    <>
      <h1>Reset your password</h1>
      <p className="auth-lead">Enter your work email and we’ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </>
  );
}
