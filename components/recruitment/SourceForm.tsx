"use client";

import { useState } from "react";
import { matchProfile } from "@/lib/matching";
import type { Job, TalentProfile } from "@/lib/types";
import { Field } from "../ui/Field";
import { Notice } from "../ui/bits";
import { MatchList } from "./MatchList";

export function SourceForm({
  profile,
  jobs,
  invitedJobIds,
  pipelineJobIds,
  onInvite,
  onAdd,
  onCancel,
}: {
  profile: TalentProfile;
  jobs: Job[];
  invitedJobIds: string[];
  pipelineJobIds: string[];
  onInvite: (jobId: string) => void;
  onAdd: (jobId: string) => void;
  onCancel: () => void;
}) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const job = jobs.find((j) => j.id === jobId);
  const invited = invitedJobIds.includes(jobId);
  const inPipeline = pipelineJobIds.includes(jobId);

  if (jobs.length === 0) {
    return (
      <>
        <Notice tone="warn">Open a vacancy first. Sourced candidates join a specific role’s pipeline.</Notice>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>Close</button>
        </div>
      </>
    );
  }

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--ink-2)" }}>
        <strong>{profile.headline}</strong> · {profile.yearsExperience} yrs · {profile.location}
        <br />
        <span className="stat-foot">{profile.education}</span>
      </p>
      <div className="form-grid">
        <Field label="For which vacancy?" full>
          {(p) => (
            <select {...p} data-autofocus value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.code})
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {job ? (
        <div style={{ marginTop: 16 }}>
          <div className="label" style={{ fontSize: 11, fontWeight: 800, color: "#52616c", marginBottom: 8 }}>
            Requirements vs. their CV
          </div>
          <MatchList matches={matchProfile(job.requirements, profile)} />
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <Notice>
          <strong>Invite to apply</strong> asks them to apply themselves (respects their choice). <strong>Add to pipeline</strong> adds them now. In a live version, only job seekers who chose to be visible to employers would appear here.
        </Notice>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn" disabled={invited || inPipeline} onClick={() => onInvite(jobId)}>
          {invited ? "Invitation sent" : "Invite to apply"}
        </button>
        <button type="button" className="btn primary" disabled={inPipeline} onClick={() => onAdd(jobId)}>
          {inPipeline ? "Already in pipeline" : "Add to pipeline"}
        </button>
      </div>
    </div>
  );
}
