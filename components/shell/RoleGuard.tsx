"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { canOpen } from "@/lib/roles";
import { useDemoStore } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/workspace";
import { EmptyState } from "../ui/bits";

/** Sends people back to their home page if they open a page their role doesn't have. The database enforces access too. */
export function RoleGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { role } = useDemoStore();
  const allowed = canOpen(role, pathname);
  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);
  if (!allowed)
    return (
      <EmptyState title="That page isn’t part of your role">
        The {ROLE_LABELS[role]} role doesn’t include this page. Taking you back to your home page.
      </EmptyState>
    );
  return <>{children}</>;
}
