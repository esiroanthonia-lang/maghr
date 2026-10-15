"use client";

import { useId, useState } from "react";
import { matchProfile } from "@/lib/matching";
import { isClosedStage, stageIndex } from "@/lib/recruitment";
import { formatDate, formatDateTime } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import { ALL_STAGES, CV_STATUSES, OFFER_STATUSES, PIPELINE_STAGES, type CvStatus, type OfferStatus, type Stage } from "@/lib/types";
import { Avatar, Badge, Notice, RelativeTime, StageBadge } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { useDialogBehaviour } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useUi } from "../shell/UiContext";
import { MatchList } from "./MatchList";

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Reviewer rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={n <= value ? "on" : ""}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function CandidateDrawer({ candidateId }: { candidateId: string }) {
  const { state, act } = useDemoStore();
  const { closeProfile, openDialog } = useUi();
  const toast = useToast();
  const ref = useDialogBehaviour(closeProfile);
  const titleId = useId();
  const [note, setNote] = useState("");
  const [confirmClose, setConfirmClose] = useState<Stage | null>(null);

  const c = state.candidates.find((x) => x.id === candidateId);
  if (!c) return null;
  const job = c.jobId ? state.jobs.find((j) => j.id === c.jobId) ?? null : null;
  const closed = isClosedStage(c.stage);
  const currentIdx = stageIndex(c.stage);
  const furthestOpen = c.stageHistory
    .map((h) => h.to)
    .filter((s) => !isClosedStage(s))
    .reduce((m, s) => Math.max(m, stageIndex(s)), 0);
  const nextStage = !closed && currentIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIdx + 1] : null;

  function move(to: Stage) {
    act({ type: "candidate/moveStage", candidateId: c!.id, to });
    setConfirmClose(null);
    toast(`${c!.name} moved to ${to}.`);
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeProfile()}>
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer-head">
          <Avatar name={c.name} large />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId}>{c.name}</h2>
            <p>
              {job ? `${job.title} · ${job.code}` : "Talent pool · no specific role"}
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <StageBadge stage={c.stage} />
              {c.inTalentPool ? <Badge tone="info">In talent pool</Badge> : null}
              {c.convertedToEmployeeId ? <Badge tone="ok">Employee record created</Badge> : null}
            </div>
          </div>
          <button type="button" className="close" onClick={closeProfile} aria-label="Close candidate profile">
            <Icon name="close" size={16} />
          </button>
        </div>

        <section className="drawer-section" aria-label="Stage">
          <h3>Hiring stage</h3>
          <div className={`stepper ${closed ? "closed" : ""}`} aria-hidden="true">
            {PIPELINE_STAGES.map((s, i) => (
              <i key={s} className={i <= (closed ? furthestOpen : currentIdx) ? "done" : ""} title={s} />
            ))}
          </div>
          <div className="button-row" style={{ alignItems: "center" }}>
            {nextStage ? (
              <button type="button" className="btn primary small" onClick={() => move(nextStage)}>
                Move to {nextStage} <Icon name="arrowRight" size={14} />
              </button>
            ) : null}
            <label className="sr-only" htmlFor={`${titleId}-stage`}>
              Set stage
            </label>
            <select
              id={`${titleId}-stage`}
              className="control"
              value={c.stage}
              onChange={(e) => {
                const to = e.target.value as Stage;
                if (isClosedStage(to)) setConfirmClose(to);
                else move(to);
              }}
            >
              {ALL_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {!closed && c.stage !== "Hired" ? (
              <>
                <button type="button" className="btn small danger" onClick={() => setConfirmClose("Rejected")}>
                  Reject
                </button>
                <button type="button" className="btn small" onClick={() => setConfirmClose("Withdrawn")}>
                  Mark withdrawn
                </button>
              </>
            ) : null}
            {closed ? (
              <button type="button" className="btn small" onClick={() => move(PIPELINE_STAGES[furthestOpen])}>
                <Icon name="refresh" size={14} /> Reopen at {PIPELINE_STAGES[furthestOpen]}
              </button>
            ) : null}
          </div>
          {confirmClose ? (
            <div className="notice warn" style={{ marginTop: 12, alignItems: "center", flexWrap: "wrap" }} role="alertdialog" aria-label={`Confirm ${confirmClose}`}>
              <div style={{ flex: 1, minWidth: 180 }}>
                {confirmClose === "Rejected"
                  ? `Reject ${c.name}? Add a note explaining the reason so the decision can be reviewed.`
                  : `Mark ${c.name} as withdrawn from this process?`}
              </div>
              <div className="button-row">
                <button type="button" className="btn small" onClick={() => setConfirmClose(null)}>
                  Cancel
                </button>
                <button type="button" className="btn small dark" onClick={() => move(confirmClose)}>
                  Confirm {confirmClose.toLowerCase()}
                </button>
              </div>
            </div>
          ) : null}
          {c.stage === "Hired" ? (
            <div style={{ marginTop: 14 }}>
              {c.convertedToEmployeeId ? (
                <Notice>
                  An employee record was created in the demo directory. The Employees module arrives in the next increment.
                </Notice>
              ) : (
                <button type="button" className="btn dark" onClick={() => openDialog({ type: "convert", candidateId: c.id })}>
                  <Icon name="userPlus" size={15} /> Convert to employee
                </button>
              )}
            </div>
          ) : null}
        </section>

        {job && c.profile.skills.length ? (
          <section className="drawer-section" aria-label="Requirements">
            <h3>Requirements vs. CV</h3>
            <p className="stat-foot" style={{ marginTop: -4, marginBottom: 12 }}>
              Shows what the CV mentions for each requirement and why. There is no score, and nothing here rejects anyone. Confirm or mark each line yourself.
            </p>
            <MatchList
              matches={matchProfile(job.requirements, c.profile)}
              reviews={c.requirementReviews}
              onReview={(requirementId, verdict) => act({ type: "candidate/reviewRequirement", candidateId: c.id, requirementId, verdict })}
            />
          </section>
        ) : null}

        <section className="drawer-section" aria-label="Details">
          <h3>Details</h3>
          <dl className="kv">
            <dt>Email</dt>
            <dd>{c.email}</dd>
            <dt>Phone</dt>
            <dd>{c.phone || "—"}</dd>
            {c.profile.headline ? (
              <>
                <dt>CV headline</dt>
                <dd>
                  {c.profile.headline} · {c.profile.yearsExperience} yrs · {c.profile.location}
                </dd>
                <dt>Skills</dt>
                <dd>
                  <div className="skill-chips" style={{ marginTop: 0 }}>
                    {c.profile.skills.map((s) => (
                      <span key={s} className="skill">
                        {s}
                      </span>
                    ))}
                  </div>
                </dd>
                <dt>Education</dt>
                <dd>{c.profile.education}</dd>
              </>
            ) : null}
            <dt>Source</dt>
            <dd>{c.source}</dd>
            <dt>Applied</dt>
            <dd>{formatDate(c.createdAt)}</dd>
            <dt>Last updated</dt>
            <dd>
              <RelativeTime iso={c.updatedAt} />
            </dd>
            <dt>
              <label htmlFor={`${titleId}-cv`}>CV status</label>
            </dt>
            <dd>
              <select
                id={`${titleId}-cv`}
                className="control"
                value={c.cvStatus}
                onChange={(e) => act({ type: "candidate/setCvStatus", candidateId: c.id, cvStatus: e.target.value as CvStatus })}
              >
                {CV_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </dd>
            <dt>Rating</dt>
            <dd>
              <StarInput value={c.rating} onChange={(rating) => act({ type: "candidate/rate", candidateId: c.id, rating })} />
            </dd>
          </dl>
          <p className="stat-foot" style={{ marginTop: 10 }}>
            Ratings are set by reviewers. Membra never rejects or ranks candidates automatically.
          </p>
        </section>

        <section className="drawer-section" aria-label="Interviews">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Interviews</h3>
            {!closed ? (
              <button type="button" className="btn small" onClick={() => openDialog({ type: "interview", candidateId: c.id })}>
                <Icon name="calendar" size={14} /> Schedule
              </button>
            ) : null}
          </div>
          {c.interviews.length === 0 ? (
            <p className="stat-foot" style={{ margin: 0 }}>
              No interviews yet.
            </p>
          ) : (
            <ul className="timeline">
              {c.interviews.map((i) => (
                <li key={i.id} style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{formatDateTime(i.scheduledFor)}</strong> · {i.mode}
                    <span>
                      {i.interviewers} · {i.location}
                    </span>
                  </div>
                  {i.status === "Scheduled" ? (
                    <div className="button-row">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => act({ type: "candidate/setInterviewStatus", candidateId: c.id, interviewId: i.id, status: "Completed" })}
                      >
                        Mark done
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => act({ type: "candidate/setInterviewStatus", candidateId: c.id, interviewId: i.id, status: "Cancelled" })}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <Badge tone={i.status === "Completed" ? "ok" : "neutral"}>{i.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="drawer-section" aria-label="Offer">
          <h3>Offer</h3>
          {c.stage === "Offer" || c.stage === "Hired" || c.offerStatus !== "Not started" ? (
            <select
              id={`${titleId}-offer`}
              aria-label="Offer status"
              className="control"
              value={c.offerStatus}
              onChange={(e) => {
                act({ type: "candidate/setOfferStatus", candidateId: c.id, offerStatus: e.target.value as OfferStatus });
                toast(`Offer status updated to ${e.target.value}.`);
              }}
            >
              {OFFER_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          ) : (
            <p className="stat-foot" style={{ margin: 0 }}>
              Offers become available when the candidate reaches the Offer stage.
            </p>
          )}
          {c.offerStatus === "Accepted" && c.stage === "Offer" ? (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn primary small" onClick={() => move("Hired")}>
                Offer accepted — move to Hired
              </button>
            </div>
          ) : null}
        </section>

        <section className="drawer-section" aria-label="Talent pool">
          <label className="check">
            <input
              type="checkbox"
              checked={c.inTalentPool}
              onChange={(e) => {
                act({ type: "candidate/setTalentPool", candidateId: c.id, inTalentPool: e.target.checked });
                toast(e.target.checked ? `${c.name} saved to the talent pool.` : `${c.name} removed from the talent pool.`);
              }}
            />
            Keep in talent pool for future roles
          </label>
        </section>

        <section className="drawer-section" aria-label="Notes">
          <h3>Notes</h3>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              act({ type: "candidate/addNote", candidateId: c.id, text: note });
              setNote("");
            }}
          >
            <label htmlFor={`${titleId}-note`} className="sr-only">
              Add a note
            </label>
            <textarea id={`${titleId}-note`} className="control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the hiring team…" />
            <button type="submit" className="btn" disabled={!note.trim()}>
              Add
            </button>
          </form>
          {c.notes.length === 0 ? (
            <p className="stat-foot" style={{ margin: 0 }}>
              No notes yet.
            </p>
          ) : (
            c.notes.map((n) => (
              <div className="note" key={n.id}>
                {n.text}
                <small>
                  {n.author} · <RelativeTime iso={n.createdAt} />
                </small>
              </div>
            ))
          )}
        </section>

        <section className="drawer-section" aria-label="History" style={{ borderBottom: 0 }}>
          <h3>Stage history</h3>
          <ul className="timeline">
            {[...c.stageHistory].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <div>
                  {h.from ? (
                    <>
                      {h.from} → <strong>{h.to}</strong>
                    </>
                  ) : (
                    <strong>Application received</strong>
                  )}
                  <span>
                    {h.by} · <RelativeTime iso={h.at} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
