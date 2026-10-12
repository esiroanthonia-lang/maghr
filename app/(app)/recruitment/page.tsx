import type { Metadata } from "next";
import { Suspense } from "react";
import { RecruitmentView } from "@/components/recruitment/RecruitmentView";

export const metadata: Metadata = { title: "Recruitment" };

export default function RecruitmentPage() {
  // RecruitmentView reads ?tab= and ?job= from the URL, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="empty">Loading recruitment…</p>}>
      <RecruitmentView />
    </Suspense>
  );
}
