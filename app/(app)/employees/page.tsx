import type { Metadata } from "next";
import { EmployeesView } from "@/components/people/EmployeesView";

export const metadata: Metadata = { title: "Employees" };

export default function Page() {
  return <EmployeesView />;
}
