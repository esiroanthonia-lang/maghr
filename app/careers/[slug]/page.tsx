import type { Metadata } from "next";
import { CareersHome, CareersNotFound } from "@/components/careers/CareersViews";
import { getCareersPage } from "@/lib/server/careers";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCareersPage(slug);
  if (!page) return { title: "Careers", robots: { index: false } };
  return {
    title: `Careers at ${page.company}`,
    description: page.intro || `Open roles at ${page.company}.`,
  };
}

export default async function CareersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getCareersPage(slug);
  if (!page) return <CareersNotFound />;
  return <CareersHome page={page} slug={slug.toLowerCase()} />;
}
