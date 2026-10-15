import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/AuthForms";
import { NotConfigured } from "@/components/auth/NotConfigured";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const { next } = await searchParams;
  return (
    <>
      <h1>Create your account</h1>
      <p className="auth-lead">Set up Membra for your company, or join a workspace you’ve been invited to.</p>
      <SignupForm next={next ?? "/"} />
    </>
  );
}
