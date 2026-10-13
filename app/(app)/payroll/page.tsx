import type { Metadata } from "next";
import { PayrollView } from "@/components/people/PayrollView";

export const metadata: Metadata = { title: "Payroll & payslips" };

export default function Page() {
  return <PayrollView />;
}
