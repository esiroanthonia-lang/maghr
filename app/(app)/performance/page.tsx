import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/ComingNext";

export const metadata: Metadata = { title: "Performance" };

export default function Page() {
  return (
    <ComingNext
      title="Performance"
      eyebrow="GROW WITH PURPOSE"
      intro="Goals, feedback, and review cycles for every team."
      planned={[
        "Team goals with progress",
        "Review cycle summary",
        "Create-goal form",
      ]}
    />
  );
}
