import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/ComingNext";

export const metadata: Metadata = { title: "Payroll & payslips" };

export default function Page() {
  return (
    <ComingNext
      title="Payroll & payslips"
      eyebrow="PAY PEOPLE ACCURATELY"
      intro="Payroll overview and employee payslip access."
      planned={[
        "Clearly labelled demo-only payroll preview",
        "Payroll run history",
        "Payslip preview layout",
        "No real calculations, PAYE, pension or payments — those need professional validation",
      ]}
    />
  );
}
