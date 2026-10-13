import type { Metadata } from "next";
import { submitApplication } from "@/app/actions/careers";
import { ApplyForm } from "@/components/careers/ApplyForm";
import { CareersJob, CareersNotFound } from "@/components/careers/CareersViews";
import { getCareersPage } from "@/lib/server/careers";

export const revalidate = 60;

type Params = Promise<{ slug: string; jobId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, jobId } = await params;
  const page = await getCareersPage(slug);
  const job = page?.jobs.find((j) => j.id === jobId);
  if (!page || !job) return { title: "Careers", robots: { index: false } };
  return {
    title: `${job.title} at ${page.company}`,
    description: `${job.title} · ${job.location} · ${job.employmentType}. Apply on ${page.company}’s careers page.`,
  };
}

export default async function CareersJobPage({ params }: { params: Params }) {
  const { slug, jobId } = await params;
  const page = await getCareersPage(slug);
  const job = page?.jobs.find((j) => j.id === jobId);
  if (!page || !job) return <CareersNotFound />;
  const clean = slug.toLowerCase();
  return (
    <CareersJob
      page={page}
      job={job}
      slug={clean}
      form={<ApplyForm action={submitApplication.bind(null, clean, job.id)} company={page.company} jobTitle={job.title} />}
    />
  );
}
