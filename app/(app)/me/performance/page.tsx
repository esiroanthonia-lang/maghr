import type { Metadata } from "next";
import { EmployeePortalPage } from "@/components/people/EmployeePortalPage";
export const metadata: Metadata = { title: "My performance" };
export default function Page() { return <EmployeePortalPage section="performance" />; }
