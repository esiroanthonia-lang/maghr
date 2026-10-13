"use client";

import { useDemoStore } from "@/lib/store";
import { HrDashboard } from "../dashboards/HrDashboard";
import { ManagerDashboard } from "../dashboards/ManagerDashboard";
import { RecruiterDashboard } from "../dashboards/RecruiterDashboard";
import { MyView } from "../people/MyView";

/** The home page. Each role gets its own dashboard. */
export function OverviewView() {
  const { role } = useDemoStore();
  if (role === "employee") return <MyView />;
  if (role === "manager") return <ManagerDashboard />;
  if (role === "recruiter") return <RecruiterDashboard />;
  return <HrDashboard />;
}
