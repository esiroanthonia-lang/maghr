import type { Metadata } from "next";
import { LeaveView } from "@/components/people/LeaveView";

export const metadata: Metadata = { title: "Leave & attendance" };

export default function Page() {
  return <LeaveView />;
}
