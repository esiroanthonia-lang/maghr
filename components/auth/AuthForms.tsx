"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInvite, createCompany, signIn, signUp, type FormState } from "@/app/actions/auth";

const initial: FormState = {};

function Feedback({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p className="auth-error" role="alert">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p className="auth-message" role="status">
        {state.message}
      </p>
    );
  return null;
}

export function LoginForm({ next, linkError }: { next: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="auth-form">
      {linkError && !state.error ? <p className="auth-error" role="alert">That sign-in link has expired or was already used. Please sign in again.</p> : null}
      <Feedback state={state} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn primary auth-submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="auth-alt">
        New to Membra? <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
      </p>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  if (state.message) return <Feedback state={state} />;
  return (
    <form action={action} className="auth-form">
      <Feedback state={state} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" autoComplete="name" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" />
        <span className="hint" id="pw-hint">At least 10 characters.</span>
      </div>
      <button className="btn primary auth-submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="auth-alt">
        Already have an account? <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link>
      </p>
    </form>
  );
}

export function CompanyForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(createCompany, initial);
  return (
    <form action={action} className="auth-form">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="company">Company name</label>
        <input id="company" name="company" required minLength={2} maxLength={120} autoFocus placeholder="e.g. Acme Nigeria Ltd" />
      </div>
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" defaultValue={defaultName} maxLength={120} />
      </div>
      <button className="btn primary auth-submit" disabled={pending}>
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
      <p className="auth-alt">You’ll be the HR admin and can invite your team from Settings.</p>
    </form>
  );
}

export function InviteForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, action, pending] = useActionState(acceptInvite, initial);
  return (
    <form action={action} className="auth-form">
      <Feedback state={state} />
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" defaultValue={defaultName} maxLength={120} autoFocus />
      </div>
      <button className="btn primary auth-submit" disabled={pending}>
        {pending ? "Joining…" : "Join workspace"}
      </button>
    </form>
  );
}
