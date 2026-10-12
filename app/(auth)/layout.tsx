import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>
            MagHR<small>BY MYJOBMAG</small>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
