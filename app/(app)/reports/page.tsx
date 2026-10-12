import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/ComingNext";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <ComingNext
      title="Reports"
      eyebrow="INSIGHTS FOR BETTER DECISIONS"
      intro="Explore workforce and recruitment metrics."
      planned={[
        "Headcount report",
        "Recruitment funnel and time-to-hire",
        "Leave summary",
      ]}
    />
  );
}
