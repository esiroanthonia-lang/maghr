import type { Metadata } from "next";
import { MyView } from "@/components/people/MyView";

export const metadata: Metadata = { title: "My space" };

export default function Page() {
  return <MyView />;
}
