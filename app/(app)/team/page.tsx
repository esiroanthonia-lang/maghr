import type { Metadata } from "next";
import { TeamView } from "@/components/dashboards/TeamView";

export const metadata: Metadata = { title: "My team" };

export default function Page() {
  return <TeamView />;
}
