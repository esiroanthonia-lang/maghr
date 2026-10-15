"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInvite, createCompany, requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/app/actions/auth";
import { PasswordInput } from "./PasswordInput";

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

export function LoginForm({ next, linkError, expired }: { next: string; linkError?: boolean; expired?: boolean }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="auth-form">
      {linkError && !state.error ? <p className="auth-error" role="alert">That sign-in link has expired or was already used. Please sign in again.</p> : null}
      {expired && !state.error ? <p className="auth-message" role="status">You were signed out because you were away for a while. Sign in again to continue.</p> : null}
      <Feedback state={state} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="field">
        <div className="label-row">
          <label htmlFor="password">Password</label>
          <Link href="/forgot-password" className="auth-small-link">
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
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
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" />
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

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  if (state.message) return <Feedback state={state} />;
  return (
    <form action={action} className="auth-form">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <button className="btn primary auth-submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="auth-alt">
        Remembered it? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="auth-form">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="password">New password</label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" autoFocus />
        <span className="hint" id="pw-hint">At least 10 characters.</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">Type it again</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={10} required />
      </div>
      <button className="btn primary auth-submit" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
