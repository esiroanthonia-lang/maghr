import type { Metadata } from "next";
import { EmployeePortalPage } from "@/components/people/EmployeePortalPage";
export const metadata: Metadata = { title: "My payslips" };
export default function Page() { return <EmployeePortalPage section="payslips" />; }
