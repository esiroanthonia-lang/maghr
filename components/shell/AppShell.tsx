"use client";

import type { ReactNode } from "react";
import type { RecruitmentState } from "@/lib/recruitment";
import { DemoStoreProvider } from "@/lib/store";
import type { WorkspaceInfo } from "@/lib/workspace";
import { ToastProvider } from "../ui/Toast";
import { DialogHost } from "./DialogHost";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { UiProvider } from "./UiContext";

export function AppShell({ children, initialState, workspace }: { children: ReactNode; initialState?: RecruitmentState; workspace?: WorkspaceInfo }) {
  const live = workspace?.mode === "live";
  return (
    <ToastProvider>
      <DemoStoreProvider initialState={initialState} workspace={workspace}>
        <UiProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <div className="app">
            <Sidebar />
            <div className="main">
              <Topbar />
              <main id="main" className="content" tabIndex={-1}>
                {children}
              </main>
              {live ? null : <p className="demo-banner">MAGHR · DEMO WORKSPACE · SYNTHETIC DATA · CHANGES RESET ON REFRESH</p>}
            </div>
          </div>
          <DialogHost />
        </UiProvider>
      </DemoStoreProvider>
    </ToastProvider>
  );
}
