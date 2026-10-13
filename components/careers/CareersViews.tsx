import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicCareersPage, PublicJob } from "@/lib/careers";
import { formatDate } from "@/lib/format";
import { LogoMark } from "../ui/Logo";

function Shell({ company, slug, children }: { company: string; slug: string; children: ReactNode }) {
  return (
    <div className="careers">
      <header className="careers-top">
        <Link href={`/careers/${slug}`} className="careers-brand">
          {company}
        </Link>
        <span className="careers-tag">Careers</span>
      </header>
      <main id="main" className="careers-main">
        {children}
      </main>
      <footer className="careers-foot">
        <LogoMark size={18} />
        <span>
          Hiring with <strong>MagHR</strong> by MyJobMag
        </span>
      </footer>
    </div>
  );
}

const meta = (j: PublicJob) => [j.location, j.employmentType].filter(Boolean).join(" · ");

export function CareersHome({ page, slug }: { page: PublicCareersPage; slug: string }) {
  const byDept = new Map<string, PublicJob[]>();
  for (const j of page.jobs) byDept.set(j.department || "Other", [...(byDept.get(j.department || "Other") ?? []), j]);
  const depts = [...byDept.keys()].sort();
  return (
    <Shell company={page.company} slug={slug}>
      <section className="careers-hero" aria-labelledby="careers-title">
        <h1 id="careers-title">Work at {page.company}</h1>
        {page.intro ? <p>{page.intro}</p> : null}
        <p className="careers-count">
          {page.jobs.length === 0 ? "No open roles right now." : `${page.jobs.length} open ${page.jobs.length === 1 ? "role" : "roles"}`}
        </p>
      </section>
      {page.jobs.length === 0 ? (
        <p className="careers-empty">We’re not hiring at the moment. Please check back soon.</p>
      ) : (
        depts.map((d) => (
          <section key={d} className="careers-dept" aria-labelledby={`dept-${d.replace(/\W+/g, "-")}`}>
            <h2 id={`dept-${d.replace(/\W+/g, "-")}`}>{d}</h2>
            <ul>
              {byDept.get(d)!.map((j) => (
                <li key={j.id}>
                  <Link href={`/careers/${slug}/jobs/${j.id}`} className="careers-role">
                    <strong>{j.title}</strong>
                    <span>{meta(j)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Shell>
  );
}

export function CareersJob({ page, job, slug, form }: { page: PublicCareersPage; job: PublicJob; slug: string; form: ReactNode }) {
  return (
    <Shell company={page.company} slug={slug}>
      <Link href={`/careers/${slug}`} className="careers-back">
        All open roles
      </Link>
      <div className="careers-job">
        <article className="careers-job-body" aria-labelledby="job-title">
          <p className="careers-dept-label">{job.department}</p>
          <h1 id="job-title">{job.title}</h1>
          <p className="careers-job-meta">
            {meta(job)}
            {job.postedAt ? ` · Posted ${formatDate(job.postedAt)}` : ""}
          </p>
          {job.description ? <div className="careers-desc">{job.description}</div> : null}
          {job.requirements.length ? (
            <>
              <h2>What you’ll need</h2>
              <ul className="careers-reqs">
                {job.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
        <aside className="careers-apply" aria-labelledby="apply-title">
          <h2 id="apply-title">Apply for this role</h2>
          {form}
        </aside>
      </div>
    </Shell>
  );
}

export function CareersNotFound() {
  return (
    <div className="careers">
      <main id="main" className="careers-main careers-missing">
        <h1>This careers page isn’t available</h1>
        <p>The link may be wrong, or the company has closed its careers page. Check the address and try again.</p>
      </main>
    </div>
  );
}
