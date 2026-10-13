import type { Metadata } from "next";
import { EmployeeProfile } from "@/components/people/EmployeeProfile";

export const metadata: Metadata = { title: "Employee profile" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeProfile employeeId={id} />;
}
