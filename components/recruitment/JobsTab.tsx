"use client";

import { useState } from "react";
import { applicationCount, filterJobs, liveChannels, pipelineCounts, sourceCounts, type JobFilter } from "@/lib/recruitment";
import { useDemoStore } from "@/lib/store";
import { DEPARTMENTS, PIPELINE_STAGES, type Department, type Job, type JobStatus } from "@/lib/types";
import { pluralise } from "@/lib/format";
import { useUi } from "../shell/UiContext";
import { Badge, EmptyState, RelativeTime } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { CHANNEL_INFO } from "./ChannelPicker";

const STAGE_COLOURS = ["#3568d4", "#7955c7", "#13808a", "#c27a2c", "#e96b3a", "#16845b"];

function statusTone(s: JobStatus) {
  return s === "Open" ? "ok" : s === "Draft" ? "warn" : "neutral";
}

function JobCard({ job, onViewCandidates }: { job: Job; onViewCandidates: (jobId: string) => void }) {
  const { state, act } = useDemoStore();
  const { openDialog } = useUi();
  const toast = useToast();
  const count = applicationCount(state.candidates, job.id);
  const counts = pipelineCounts(state.candidates, job.id);
  const inPipeline = PIPELINE_STAGES.reduce((n, s) => n + counts[s], 0);
  const live = liveChannels(job);
  const topSource = sourceCounts(state.candidates, job.id)[0];

  function setStatus(status: JobStatus) {
    act({ type: "job/setStatus", jobId: job.id, status });
    toast(`${job.title} is now ${status.toLowerCase()}.`);
  }

  return (
    <article className="job-card" aria-labelledby={`${job.id}-title`}>
      <div className="job-card-top">
        <Badge tone={statusTone(job.status)}>{job.status}</Badge>
        <span className="job-code">{job.code}</span>
      </div>
      <h3 id={`${job.id}-title`}>{job.title}</h3>
      <p>
        {job.department} · {job.location}
      </p>
      <div className="channel-chips" aria-label={live.length ? `Advertised on ${live.join(", ")}` : "Not advertised"}>
        {live.length ? (
          live.map((c) => (
            <span key={c} className="channel-chip">
              <i style={{ background: CHANNEL_INFO[c].colour }} aria-hidden="true" />
              {c}
            </span>
          ))
        ) : (
          <span className="channel-chip off">Not advertised</span>
        )}
      </div>
      <div className="job-meta">
        <span>
          <Icon name="people" size={13} /> {pluralise(count, "applicant")}
        </span>
        <span>
          <Icon name="clock" size={13} /> <RelativeTime iso={job.createdAt} />
        </span>
        <span>Owner: {job.owner}</span>
        {topSource ? <span>Top source: {topSource.source}</span> : null}
      </div>
      {inPipeline > 0 ? (
        <div className="mini-funnel" role="img" aria-label={PIPELINE_STAGES.map((s) => `${counts[s]} ${s}`).join(", ")}>
          {PIPELINE_STAGES.map((s, i) =>
            counts[s] ? <i key={s} title={`${s}: ${counts[s]}`} style={{ width: `${(counts[s] / inPipeline) * 100}%`, background: STAGE_COLOURS[i] }} /> : null,
          )}
        </div>
      ) : null}
      <div className="job-card-foot">
        <strong>{job.employmentType}</strong>
        <div className="button-row">
          {job.status === "Draft" ? (
            <button type="button" className="btn small" onClick={() => setStatus("Open")}>
              Open role
            </button>
          ) : job.status === "Open" ? (
            <button type="button" className="btn small" onClick={() => openDialog({ type: "candidate", jobId: job.id })} aria-label={`Add candidate to ${job.title}`}>
              <Icon name="plus" size={13} />
            </button>
          ) : (
            <button type="button" className="btn small" onClick={() => setStatus("Open")}>
              Reopen
            </button>
          )}
          <button type="button" className="soft-btn" onClick={() => onViewCandidates(job.id)}>
            View candidates →
          </button>
        </div>
      </div>
      <div className="button-row" style={{ marginTop: 8, justifyContent: "space-between" }}>
        {job.status !== "Closed" ? (
          <button type="button" className="link-btn" onClick={() => openDialog({ type: "publish", jobId: job.id })}>
            {live.length ? "Manage adverts" : "Publish"}
          </button>
        ) : <span />}
        {job.status === "Open" ? (
          <button type="button" className="link-btn" style={{ color: "var(--muted)" }} onClick={() => setStatus("Closed")}>
            Close vacancy
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function JobsTab({ onViewCandidates }: { onViewCandidates: (jobId: string) => void }) {
  const { state } = useDemoStore();
  const { openDialog } = useUi();
  const [filter, setFilter] = useState<Required<JobFilter>>({ query: "", status: "all", department: "all" });
  const jobs = filterJobs(state.jobs, filter);
  const filtered = filter.query || filter.status !== "all" || filter.department !== "all";

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <label className="sr-only" htmlFor="job-search">
            Search jobs
          </label>
          <input id="job-search" className="control" type="search" placeholder="Search title, code, owner…" value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
          <label className="sr-only" htmlFor="job-status">
            Filter by status
          </label>
          <select id="job-status" className="control" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as JobStatus | "all" })}>
            <option value="all">All statuses</option>
            <option value="Open">Open</option>
            <option value="Draft">Draft</option>
            <option value="Closed">Closed</option>
          </select>
          <label className="sr-only" htmlFor="job-dept">
            Filter by department
          </label>
          <select id="job-dept" className="control" value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value as Department | "all" })}>
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn" onClick={() => openDialog({ type: "candidate" })}>
          <Icon name="userPlus" size={15} /> Add candidate
        </button>
      </div>
      {filtered ? (
        <p className="result-note" aria-live="polite">
          Showing {pluralise(jobs.length, "vacancy", "vacancies")} of {state.jobs.length}
        </p>
      ) : null}
      {jobs.length === 0 ? (
        <div className="panel">
          <EmptyState
            title={state.jobs.length === 0 ? "No vacancies yet" : "No vacancies match your filters"}
            action={
              filtered ? (
                <button type="button" className="btn" onClick={() => setFilter({ query: "", status: "all", department: "all" })}>
                  Clear filters
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={() => openDialog({ type: "job" })}>
                  Create a job
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="job-cards">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} onViewCandidates={onViewCandidates} />
          ))}
        </div>
      )}
    </>
  );
}
