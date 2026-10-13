"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { pluralise } from "@/lib/format";
import { filterCandidates, isActiveCandidate, talentPool, upcomingInterviews } from "@/lib/recruitment";
import { useDemoStore, useNow } from "@/lib/store";
import { canEditRecruitment } from "@/lib/workspace";
import { ALL_STAGES, type Stage } from "@/lib/types";
import { useUi } from "../shell/UiContext";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { CandidateTable } from "./CandidateTable";
import { InterviewsTab } from "./InterviewsTab";
import { JobsTab } from "./JobsTab";
import { PipelineBoard } from "./PipelineBoard";
import { SourcingTab } from "./SourcingTab";
import { TalentPoolTab } from "./TalentPoolTab";

const TABS = [
  { id: "jobs", label: "Jobs" },
  { id: "pipeline", label: "Candidate pipeline" },
  { id: "interviews", label: "Interviews" },
  { id: "talent", label: "Talent pool" },
  { id: "source", label: "Find talent" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type StageFilter = Stage | "all" | "active";

export function RecruitmentView() {
  const { state, workspace, role } = useDemoStore();
  const readOnly = !canEditRecruitment(workspace, role);
  const { openDialog } = useUi();
  const now = useNow();
  const router = useRouter();
  const pathname = usePathname() ?? "/recruitment";
  const params = useSearchParams();

  // Tab, job, stage and view live in the URL so links from Overview and search land in the right place.
  const tabParam = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "jobs";
  const jobId = params.get("job") ?? "all";
  const stageParam = params.get("stage");
  const stage: StageFilter = stageParam && (ALL_STAGES as readonly string[]).includes(stageParam) ? (stageParam as Stage) : stageParam === "all" ? "all" : "active";
  const view = params.get("view") === "table" || (stage !== "active" && stage !== "all") ? "table" : "board";
  const [query, setQuery] = useState("");

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const openJobs = state.jobs.filter((j) => j.status === "Open").length;
  const active = state.candidates.filter((c) => c.jobId && isActiveCandidate(c)).length;
  const weekAhead = now ? upcomingInterviews(state, now).filter((r) => new Date(r.interview.scheduledFor).getTime() < now.getTime() + 7 * 864e5).length : 0;
  const offersOut = state.candidates.filter((c) => c.stage === "Offer" && c.offerStatus === "Sent").length;
  const offersDraft = state.candidates.filter((c) => c.stage === "Offer" && c.offerStatus !== "Sent").length;

  const candidates = filterCandidates(state.candidates, state.jobs, { query, jobId, stage: view === "board" ? "all" : stage });
  const selectedJob = state.jobs.find((j) => j.id === jobId);
  const counts: Partial<Record<TabId, number>> = {
    jobs: state.jobs.length,
    talent: talentPool(state.candidates).length,
    source: state.talentDb.length,
  };

  return (
    <>
      <PageHeader
        eyebrow="FIND YOUR NEXT GREAT HIRE"
        title="Recruitment"
        intro="Manage vacancies, candidates, interviews, and offers in one place."
        actions={
          <>
            {state.careers.enabled && state.careers.slug ? (
              <a className="btn" href={`/careers/${state.careers.slug}`} target="_blank" rel="noopener">
                <Icon name="briefcase" size={15} /> Careers page
              </a>
            ) : null}
            <button type="button" className="btn" onClick={() => openDialog({ type: "candidate", jobId: selectedJob?.status === "Open" ? selectedJob.id : undefined })}>
              <Icon name="userPlus" size={15} /> Add candidate
            </button>
            <button type="button" className="btn primary" onClick={() => openDialog({ type: "job" })}>
              <Icon name="plus" size={15} /> Create a job
            </button>
          </>
        }
      />

      {readOnly ? (
        <div style={{ marginBottom: 16 }}>
          <Notice>You have view-only access to recruitment. You can read profiles; ask an HR admin if you need to make changes.</Notice>
        </div>
      ) : null}

      <div className="stats">
        <StatCard label="Open positions" icon="briefcase" tone="orange" value={openJobs} foot="Currently accepting candidates" />
        <StatCard label="Active applicants" icon="people" tone="blue" value={active} foot="Not yet hired, rejected or withdrawn" />
        <StatCard label="Interviews next 7 days" icon="calendar" tone="green" value={weekAhead} foot="Scheduled interviews" />
        <StatCard label="Offers out" icon="check" tone="purple" value={offersOut} foot={offersDraft ? `${pluralise(offersDraft, "offer")} still to send` : "Awaiting candidate response"} />
      </div>

      <div className="tabs" role="tablist" aria-label="Recruitment sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className="tab"
            onClick={() => setParams({ tab: t.id === "jobs" ? null : t.id })}
          >
            {t.label}
            {counts[t.id] !== undefined ? <span className="count">{counts[t.id]}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "jobs" ? <JobsTab onViewCandidates={(id) => setParams({ tab: "pipeline", job: id })} /> : null}

        {tab === "pipeline" ? (
          <>
            <div className="toolbar">
              <div className="filters">
                <label className="sr-only" htmlFor="cand-search">
                  Search candidates
                </label>
                <input id="cand-search" className="control" type="search" placeholder="Search name, email, role…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <label className="sr-only" htmlFor="cand-job">
                  Filter by vacancy
                </label>
                <select id="cand-job" className="control" value={jobId} onChange={(e) => setParams({ job: e.target.value === "all" ? null : e.target.value })}>
                  <option value="all">All vacancies</option>
                  {state.jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.status})
                    </option>
                  ))}
                </select>
                {view === "table" ? (
                  <>
                    <label className="sr-only" htmlFor="cand-stage">
                      Filter by stage
                    </label>
                    <select id="cand-stage" className="control" value={stage} onChange={(e) => setParams({ stage: e.target.value === "active" ? null : e.target.value })}>
                      <option value="active">Active stages</option>
                      <option value="all">All stages</option>
                      {ALL_STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>
              <div className="view-toggle" role="group" aria-label="Pipeline view">
                <button type="button" aria-pressed={view === "board"} onClick={() => setParams({ view: null, stage: null })}>
                  <Icon name="board" size={14} /> Board
                </button>
                <button type="button" aria-pressed={view === "table"} onClick={() => setParams({ view: "table" })}>
                  <Icon name="list" size={14} /> Table
                </button>
              </div>
            </div>
            {selectedJob || query ? (
              <p className="result-note" aria-live="polite">
                {pluralise(candidates.length, "candidate")}
                {selectedJob ? ` for ${selectedJob.title}` : ""}
                {query ? ` matching “${query.trim()}”` : ""}
                {" · "}
                <button type="button" className="link-btn" onClick={() => { setQuery(""); setParams({ job: null }); }}>
                  Clear
                </button>
              </p>
            ) : null}
            {view === "board" ? (
              <PipelineBoard candidates={candidates} jobs={state.jobs} onShowClosed={(s) => setParams({ view: "table", stage: s })} />
            ) : (
              <Panel title="Candidates" subtitle="Click a name to open the full profile">
                {candidates.length === 0 ? (
                  <EmptyState title="No candidates match these filters">Try another vacancy or stage, or clear the search.</EmptyState>
                ) : (
                  <CandidateTable candidates={candidates} jobs={state.jobs} />
                )}
              </Panel>
            )}
          </>
        ) : null}

        {tab === "interviews" ? <InterviewsTab /> : null}

        {tab === "source" ? <SourcingTab /> : null}

        {tab === "talent" ? (
          <>
            <div className="toolbar">
              <div className="filters">
                <label className="sr-only" htmlFor="pool-search">
                  Search talent pool
                </label>
                <input id="pool-search" className="control" type="search" placeholder="Search talent pool…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            <TalentPoolTab query={query} />
          </>
        ) : null}
      </div>
    </>
  );
}
