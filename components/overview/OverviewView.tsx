"use client";

import Link from "next/link";
import { onLeaveOn } from "@/lib/people";
import { formatDateTime, greeting, longDate, pluralise } from "@/lib/format";
import { funnelCounts, isActiveCandidate, sourceCounts, upcomingInterviews } from "@/lib/recruitment";
import { useDemoStore, useNow } from "@/lib/store";
import type { ActivityKind } from "@/lib/types";
import { useUi } from "../shell/UiContext";
import { Avatar, EmptyState, PageHeader, Panel, RelativeTime, StageBadge, StatCard } from "../ui/bits";
import { Icon } from "../ui/Icon";

const DOT: Record<ActivityKind, string> = {
  application: "dot-orange",
  publish: "dot-blue",
  sourcing: "dot-purple",
  whatsapp: "dot-green",
  leave: "dot-green",
  performance: "dot-purple",
  payroll: "dot-orange",
  settings: "dot-blue",
  stage: "dot-purple",
  interview: "dot-blue",
  offer: "dot-orange",
  job: "dot-blue",
  employee: "dot-green",
  note: "dot-purple",
};

export function OverviewView() {
  const { state } = useDemoStore();
  const { openDialog, openProfile } = useUi();
  const now = useNow();

  const openJobs = state.jobs.filter((j) => j.status === "Open");
  const departments = new Set(openJobs.map((j) => j.department)).size;
  const active = state.candidates.filter((c) => c.jobId && isActiveCandidate(c));
  const weekAgo = now ? now.getTime() - 7 * 24 * 3600 * 1000 : 0;
  const newThisWeek = now ? state.candidates.filter((c) => new Date(c.createdAt).getTime() >= weekAgo).length : null;
  const funnel = funnelCounts(state.candidates.filter((c) => c.jobId));
  const top = Math.max(1, funnel[0]?.reached ?? 1);
  const recent = [...state.candidates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const interviews = now ? upcomingInterviews(state, now).slice(0, 3) : [];
  const sources = sourceCounts(state.candidates);
  const maxSource = Math.max(1, sources[0]?.count ?? 1);
  const headcount = state.employees.filter((e) => e.status !== "Exited").length;
  const onboarding = state.employees.filter((e) => e.status === "Onboarding").length;
  const outToday = now ? onLeaveOn(state, now.toISOString().slice(0, 10)).length : 0;
  const pendingLeave = state.leave.filter((l) => l.status === "Pending").length;
  const toReview = state.candidates.filter((c) => c.stage === "Applied" && c.jobId).length;

  return (
    <>
      <PageHeader
        eyebrow={now ? longDate(now) : " "}
        title={`${now ? greeting(now) : "Welcome"}, HR team`}
        intro="Here’s what’s happening with your people today."
        actions={
          <button type="button" className="btn primary" onClick={() => openDialog({ type: "job" })}>
            <Icon name="plus" size={15} /> Create a job
          </button>
        }
      />

      <div className="stats">
        <StatCard label="Employees" icon="people" tone="orange" value={headcount} foot={`${onboarding} onboarding`} />
        <StatCard label="Open positions" icon="briefcase" tone="blue" value={openJobs.length} foot={`Across ${pluralise(departments, "department")}`} />
        <StatCard label="On leave today" icon="calendar" tone="green" value={outToday} foot={pendingLeave ? `${pluralise(pendingLeave, "request")} need a decision` : "No requests waiting"} />
        <StatCard
          label="Active applicants"
          icon="userPlus"
          tone="purple"
          value={active.length}
          foot={newThisWeek === null ? "In open pipelines" : <><span className="up">↑ {newThisWeek}</span> in the last 7 days</>}
        />
      </div>

      <div className="dashboard-grid">
        <div>
          <Panel
            id="glance"
            title="Recruitment at a glance"
            subtitle="How far candidates have progressed across all roles"
            action={
              <Link className="link-btn" href="/recruitment?tab=pipeline">
                View pipeline →
              </Link>
            }
          >
            <div className="funnel">
              <div className="funnel-top">
                <strong>Candidate funnel</strong>
                <span>{pluralise(funnel[0]?.reached ?? 0, "candidate")} in total</span>
              </div>
              <div className="stages">
                {funnel.map((f) => (
                  <Link key={f.stage} href="/recruitment?tab=pipeline" className="stage-tile" aria-label={`${f.reached} reached ${f.stage}`}>
                    <div className="stage-name">{f.stage}</div>
                    <div className="stage-num">{f.reached}</div>
                    <div className="bar" aria-hidden="true">
                      <i style={{ width: `${Math.round((f.reached / top) * 100)}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
            id="recent"
            title="Recent applicants"
            subtitle="Keep your hiring process moving"
            action={
              <Link className="link-btn" href="/recruitment?tab=pipeline&view=table">
                View all
              </Link>
            }
          >
            {recent.length === 0 ? (
              <EmptyState title="No applicants yet">New applications will appear here.</EmptyState>
            ) : (
              <ul className="list">
                {recent.map((c) => {
                  const job = state.jobs.find((j) => j.id === c.jobId);
                  return (
                    <li key={c.id} className="list-row">
                      <button type="button" className="row-btn" onClick={() => openProfile(c.id)}>
                        <Avatar name={c.name} />
                        <span className="person-info">
                          <strong>{c.name}</strong>
                          <span>
                            {job?.title ?? "Talent pool"} · <RelativeTime iso={c.createdAt} />
                          </span>
                        </span>
                      </button>
                      <StageBadge stage={c.stage} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel id="sources" title="Where applicants come from" subtitle="Every applicant is tagged with the channel that brought them">
            <ul className="source-bars">
              {sources.map((x) => (
                <li key={x.source}>
                  <span>{x.source}</span>
                  <span className="bar" aria-hidden="true">
                    <i style={{ width: `${Math.round((x.count / maxSource) * 100)}%` }} />
                  </span>
                  <span>{x.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="right-stack">
          <Panel title="Quick actions" subtitle="Get things done faster">
            <div className="quick-grid">
              <button type="button" className="quick" onClick={() => openDialog({ type: "job" })}>
                <span className="quick-icon"><Icon name="plus" size={16} /></span>
                <strong>Create job opening</strong>
                <span>Start a new vacancy</span>
              </button>
              <button type="button" className="quick" onClick={() => openDialog({ type: "candidate" })}>
                <span className="quick-icon"><Icon name="userPlus" size={16} /></span>
                <strong>Add candidate</strong>
                <span>Build your talent pool</span>
              </button>
              <Link className="quick" href="/recruitment?tab=pipeline&stage=Applied&view=table">
                <span className="quick-icon"><Icon name="doc" size={16} /></span>
                <strong>Review applications</strong>
                <span>{pluralise(toReview, "new application")}</span>
              </Link>
              <Link className="quick" href="/leave">
                <span className="quick-icon"><Icon name="calendar" size={16} /></span>
                <strong>Review leave</strong>
                <span>{pluralise(pendingLeave, "request")} pending</span>
              </Link>
            </div>
          </Panel>

          <Panel
            title="Upcoming interviews"
            subtitle="Scheduled interviews"
            action={
              <Link className="link-btn" href="/recruitment?tab=interviews">
                See all
              </Link>
            }
          >
            {interviews.length === 0 ? (
              <EmptyState title="Nothing scheduled">Schedule interviews from a candidate’s profile.</EmptyState>
            ) : (
              <ul className="list">
                {interviews.map(({ interview, candidate, job }) => (
                  <li key={interview.id} className="list-row">
                    <button type="button" className="row-btn" onClick={() => openProfile(candidate.id)}>
                      <Avatar name={candidate.name} />
                      <span className="person-info">
                        <strong>{candidate.name}</strong>
                        <span>
                          {formatDateTime(interview.scheduledFor)} · {job?.title ?? "Talent pool"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity" subtitle="Updates from your workspace">
            <ul className="activity">
              {state.activity.slice(0, 6).map((a) => (
                <li key={a.id} className="activity-item">
                  <span className={`activity-dot ${DOT[a.kind]}`} aria-hidden="true" />
                  <div className="activity-text">
                    <strong>{a.title}</strong>
                    <span>
                      {a.detail} · <RelativeTime iso={a.at} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
