import type { Metadata } from "next";
import Link from "next/link";
import { InviteForm } from "@/components/auth/AuthForms";
import { NotConfigured } from "@/components/auth/NotConfigured";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const here = `/invite/${encodeURIComponent(token)}`;
  if (!user) {
    return (
      <>
        <h1>You’ve been invited to Membra</h1>
        <p className="auth-lead">Sign in or create an account with the email address the invitation was sent to.</p>
        <div className="button-row">
          <Link className="btn primary" href={`/signup?next=${encodeURIComponent(here)}`}>
            Create account
          </Link>
          <Link className="btn" href={`/login?next=${encodeURIComponent(here)}`}>
            Sign in
          </Link>
        </div>
      </>
    );
  }
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return (
    <>
      <h1>Join your company’s workspace</h1>
      <p className="auth-lead">You’re signed in as {user.email}.</p>
      <InviteForm token={token} defaultName={name} />
    </>
  );
}
