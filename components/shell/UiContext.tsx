"use client";

// Cross-page UI state: which dialog is open and which candidate profile is showing.
// Keeping these at the shell level lets any page (Overview, Recruitment, search) open them.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Dialog =
  | { type: "job" }
  | { type: "candidate"; jobId?: string | null }
  | { type: "interview"; candidateId: string }
  | { type: "convert"; candidateId: string }
  | { type: "publish"; jobId: string }
  | { type: "source"; profileId: string };

interface UiValue {
  dialog: Dialog | null;
  openDialog: (d: Dialog) => void;
  closeDialog: () => void;
  profileId: string | null;
  openProfile: (candidateId: string) => void;
  closeProfile: () => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const value = useMemo<UiValue>(
    () => ({
      dialog,
      openDialog: setDialog,
      closeDialog: () => setDialog(null),
      profileId,
      openProfile: setProfileId,
      closeProfile: () => setProfileId(null),
    }),
    [dialog, profileId],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside <UiProvider>");
  return ctx;
}
