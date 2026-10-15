import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";
import { NotConfigured } from "@/components/auth/NotConfigured";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; expired?: string }> }) {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const { next, error, expired } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <p className="auth-lead">Welcome back. Sign in to your company’s Membra workspace.</p>
      <LoginForm next={next ?? "/"} linkError={error === "link"} expired={expired === "1"} />
    </>
  );
}
