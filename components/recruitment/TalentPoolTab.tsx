"use client";

import { talentPool } from "@/lib/recruitment";
import { useDemoStore } from "@/lib/store";
import { useUi } from "../shell/UiContext";
import { Avatar, EmptyState, Panel, RelativeTime, StageBadge, Stars } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

export function TalentPoolTab({ query }: { query: string }) {
  const { state, act } = useDemoStore();
  const { openProfile, openDialog } = useUi();
  const toast = useToast();
  const q = query.trim().toLowerCase();
  const pool = talentPool(state.candidates).filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  const openJobs = state.jobs.filter((j) => j.status === "Open");

  return (
    <Panel
      title="Talent pool"
      subtitle="Strong candidates kept on file for future roles"
      action={
        <button type="button" className="btn" onClick={() => openDialog({ type: "candidate", jobId: null })}>
          <Icon name="plus" size={14} /> Add to talent pool
        </button>
      }
    >
      {pool.length === 0 ? (
        <EmptyState title={q ? "Nobody in the talent pool matches your search" : "Your talent pool is empty"}>
          {q ? null : "Tick “Keep in talent pool” on any candidate profile to save them here."}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col">Last considered for</th>
                <th scope="col">Last stage</th>
                <th scope="col">Rating</th>
                <th scope="col">Added</th>
                <th scope="col">Consider for an open role</th>
              </tr>
            </thead>
            <tbody>
              {pool.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button type="button" className="row-btn" onClick={() => openProfile(c.id)}>
                      <Avatar name={c.name} />
                      <span className="person-info">
                        <strong>{c.name}</strong>
                        <span>{c.email}</span>
                      </span>
                    </button>
                  </td>
                  <td>{c.jobId ? state.jobs.find((j) => j.id === c.jobId)?.title ?? "—" : "No specific role"}</td>
                  <td>
                    <StageBadge stage={c.stage} />
                  </td>
                  <td>
                    <Stars value={c.rating} />
                  </td>
                  <td>
                    <RelativeTime iso={c.createdAt} />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`assign-${c.id}`}>
                      Consider {c.name} for
                    </label>
                    <select
                      id={`assign-${c.id}`}
                      className="control"
                      value=""
                      onChange={(e) => {
                        const job = openJobs.find((j) => j.id === e.target.value);
                        if (!job) return;
                        act({ type: "candidate/assignToJob", candidateId: c.id, jobId: job.id });
                        toast(`${c.name} added to the ${job.title} pipeline at Applied.`);
                      }}
                    >
                      <option value="">Choose a role…</option>
                      {openJobs
                        .filter((j) => j.id !== c.jobId)
                        .map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.title}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
