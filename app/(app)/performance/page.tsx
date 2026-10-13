import type { Metadata } from "next";
import { PerformanceView } from "@/components/people/PerformanceView";

export const metadata: Metadata = { title: "Performance" };

export default function Page() {
  return <PerformanceView />;
}
