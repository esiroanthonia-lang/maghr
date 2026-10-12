"use client";

import { nextAction } from "@/lib/recruitment";
import { useNow } from "@/lib/store";
import type { Candidate, Job } from "@/lib/types";
import { useUi } from "../shell/UiContext";
import { Avatar, Badge, RelativeTime, Stars } from "../ui/bits";
import { StageSelect } from "./StageSelect";

export function CandidateTable({ candidates, jobs }: { candidates: Candidate[]; jobs: Job[] }) {
  const { openProfile } = useUi();
  const now = useNow();
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">Candidates</caption>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col">Applied for</th>
            <th scope="col">Stage</th>
            <th scope="col">Rating</th>
            <th scope="col">CV</th>
            <th scope="col">Applied</th>
            <th scope="col">Next action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} data-candidate={c.id}>
              <td>
                <button type="button" className="row-btn" onClick={() => openProfile(c.id)}>
                  <Avatar name={c.name} />
                  <span className="person-info">
                    <strong>{c.name}</strong>
                    <span>{c.email}</span>
                  </span>
                </button>
              </td>
              <td>{c.jobId ? jobs.find((j) => j.id === c.jobId)?.title ?? "—" : "Talent pool"}</td>
              <td>
                <StageSelect candidate={c} />
              </td>
              <td>
                <Stars value={c.rating} />
              </td>
              <td>
                <Badge tone={c.cvStatus === "Missing" ? "warn" : c.cvStatus === "Reviewed" ? "ok" : "info"}>{c.cvStatus}</Badge>
              </td>
              <td>
                <RelativeTime iso={c.createdAt} />
              </td>
              <td className="cell-strong">{nextAction(c, now ?? undefined)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
