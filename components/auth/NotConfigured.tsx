import Link from "next/link";

export function NotConfigured() {
  return (
    <>
      <h1>Sign-in isn’t set up yet</h1>
      <p className="auth-lead">This copy of Membra has no Supabase settings, so it runs as a demo with synthetic data. See SETUP.md to connect a database.</p>
      <Link className="btn primary auth-submit" href="/">
        Open the demo
      </Link>
    </>
  );
}
