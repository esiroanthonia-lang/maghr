"use client";

import { formatDateTime } from "@/lib/format";
import { useDemoStore, useNow } from "@/lib/store";
import { useUi } from "../shell/UiContext";
import { Avatar, Badge, EmptyState, Panel } from "../ui/bits";

export function InterviewsTab() {
  const { state } = useDemoStore();
  const { openProfile } = useUi();
  const now = useNow();

  const rows = state.candidates
    .flatMap((c) => c.interviews.map((i) => ({ i, c, job: state.jobs.find((j) => j.id === c.jobId) })))
    .sort((a, b) => a.i.scheduledFor.localeCompare(b.i.scheduledFor));
  const upcoming = rows.filter((r) => r.i.status === "Scheduled" && (!now || new Date(r.i.scheduledFor) >= now));
  const past = rows.filter((r) => !upcoming.includes(r)).reverse();
  const shortlisted = state.candidates.filter((c) => c.stage === "Shortlisted" && !c.interviews.some((i) => i.status === "Scheduled"));

  const table = (list: typeof rows, empty: string) =>
    list.length === 0 ? (
      <EmptyState title={empty} />
    ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Candidate</th>
              <th scope="col">Role</th>
              <th scope="col">When</th>
              <th scope="col">Format</th>
              <th scope="col">Interviewers</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ i, c, job }) => (
              <tr key={i.id}>
                <td>
                  <button type="button" className="row-btn" onClick={() => openProfile(c.id)}>
                    <Avatar name={c.name} />
                    <span className="person-info">
                      <strong>{c.name}</strong>
                    </span>
                  </button>
                </td>
                <td>{job?.title ?? "Talent pool"}</td>
                <td>{formatDateTime(i.scheduledFor)}</td>
                <td>{i.mode}</td>
                <td>{i.interviewers}</td>
                <td>
                  <Badge tone={i.status === "Completed" ? "ok" : i.status === "Cancelled" ? "neutral" : now && new Date(i.scheduledFor) < now ? "warn" : "info"}>
                    {i.status === "Scheduled" && now && new Date(i.scheduledFor) < now ? "Needs feedback" : i.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <>
      <Panel title="Upcoming interviews" subtitle="Calendar invites are not sent in this prototype">
        {table(upcoming, "No upcoming interviews")}
      </Panel>
      {shortlisted.length > 0 ? (
        <Panel title="Ready to schedule" subtitle="Shortlisted candidates without an interview booked">
          <ul className="list">
            {shortlisted.map((c) => (
              <li key={c.id} className="list-row">
                <button type="button" className="row-btn" onClick={() => openProfile(c.id)}>
                  <Avatar name={c.name} />
                  <span className="person-info">
                    <strong>{c.name}</strong>
                    <span>{state.jobs.find((j) => j.id === c.jobId)?.title ?? "Talent pool"}</span>
                  </span>
                </button>
                <ScheduleButton candidateId={c.id} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="Past and cancelled" subtitle="Most recent first">
        {table(past, "No past interviews yet")}
      </Panel>
    </>
  );
}

function ScheduleButton({ candidateId }: { candidateId: string }) {
  const { openDialog } = useUi();
  return (
    <button type="button" className="btn small" onClick={() => openDialog({ type: "interview", candidateId })}>
      Schedule
    </button>
  );
}
