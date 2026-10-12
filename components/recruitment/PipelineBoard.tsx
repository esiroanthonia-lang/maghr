"use client";

import { useState } from "react";
import { isClosedStage } from "@/lib/recruitment";
import { useDemoStore } from "@/lib/store";
import { PIPELINE_STAGES, type Candidate, type Job, type Stage } from "@/lib/types";
import { useUi } from "../shell/UiContext";
import { Avatar, Stars } from "../ui/bits";
import { useToast } from "../ui/Toast";
import { StageSelect } from "./StageSelect";

/**
 * Kanban view. Cards can be dragged between columns with a mouse;
 * every card also has a stage picker so keyboard and touch users can move it too.
 */
export function PipelineBoard({ candidates, jobs, onShowClosed }: { candidates: Candidate[]; jobs: Job[]; onShowClosed: (stage: Stage) => void }) {
  const { act } = useDemoStore();
  const { openProfile } = useUi();
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const open = candidates.filter((c) => !isClosedStage(c.stage));
  const rejected = candidates.filter((c) => c.stage === "Rejected").length;
  const withdrawn = candidates.filter((c) => c.stage === "Withdrawn").length;
  const jobTitle = (id: string | null) => (id ? jobs.find((j) => j.id === id)?.title ?? "—" : "Talent pool");

  return (
    <>
      <div className="board" role="list" aria-label="Candidate pipeline board">
        {PIPELINE_STAGES.map((stage) => {
          const items = open.filter((c) => c.stage === stage);
          return (
            <section
              key={stage}
              role="listitem"
              aria-label={`${stage}: ${items.length}`}
              className={`column ${over === stage ? "drop-target" : ""}`}
              data-stage={stage}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const c = open.find((x) => x.id === dragId);
                setOver(null);
                setDragId(null);
                if (c && c.stage !== stage) {
                  act({ type: "candidate/moveStage", candidateId: c.id, to: stage });
                  toast(`${c.name} moved to ${stage}.`);
                }
              }}
            >
              <div className="column-head">
                <span>{stage}</span>
                <span className="n">{items.length}</span>
              </div>
              {items.length === 0 ? <div className="column-empty">No candidates</div> : null}
              {items.map((c) => (
                <article
                  key={c.id}
                  className="card"
                  draggable
                  data-candidate={c.id}
                  onDragStart={(e) => {
                    setDragId(c.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", c.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                >
                  <div className="card-top">
                    <Avatar name={c.name} />
                    <div style={{ minWidth: 0 }}>
                      <button type="button" className="card-name" onClick={() => openProfile(c.id)}>
                        {c.name}
                      </button>
                      <div className="card-role">{jobTitle(c.jobId)}</div>
                    </div>
                  </div>
                  <div className="card-foot">
                    <Stars value={c.rating} />
                    <StageSelect candidate={c} compact />
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
      <div className="closed-strip">
        <span>Closed:</span>
        <button type="button" className="btn small" onClick={() => onShowClosed("Rejected")}>
          Rejected · {rejected}
        </button>
        <button type="button" className="btn small" onClick={() => onShowClosed("Withdrawn")}>
          Withdrawn · {withdrawn}
        </button>
        <span>Drag cards between columns, or use the stage picker on each card.</span>
      </div>
    </>
  );
}
