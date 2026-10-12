import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/ComingNext";

export const metadata: Metadata = { title: "Leave & attendance" };

export default function Page() {
  return (
    <ComingNext
      title="Leave & attendance"
      eyebrow="TIME AWAY, MADE CLEAR"
      intro="Review requests and keep track of who's in and out."
      planned={[
        "Leave request list with approve / decline (demo)",
        "Record-leave form",
        "Who's out today and pending counts",
        "Attendance summary",
      ]}
    />
  );
}
