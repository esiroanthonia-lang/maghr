import type { Metadata } from "next";
import { EmployeePortalPage } from "@/components/people/EmployeePortalPage";
export const metadata: Metadata = { title: "My attendance" };
export default function Page() { return <EmployeePortalPage section="attendance" />; }
