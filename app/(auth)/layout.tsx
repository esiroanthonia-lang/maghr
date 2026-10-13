import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Wordmark />
        </div>
        {children}
      </div>
    </main>
  );
}
