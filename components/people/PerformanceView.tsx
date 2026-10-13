"use client";

import { useState, type FormEvent } from "react";
import { formatDate, pluralise } from "@/lib/format";
import type { GoalInput } from "@/lib/people";
import { GOAL_DEPARTMENTS, REVIEW_STATUSES, type GoalDepartment, type ReviewStatus } from "@/lib/types";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "../ui/bits";
import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { usePeople } from "./usePeople";

function GoalForm({ onSubmit, onCancel }: { onSubmit: (g: GoalInput) => void; onCancel: () => void }) {
  const [g, setG] = useState<GoalInput>({ title: "", ownerName: "", department: "Company", dueDate: "" });
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (g.title.trim().length < 3) return setError("Describe the goal in a few words.");
    if (!g.ownerName.trim()) return setError("Who owns this goal?");
    if (!g.dueDate) return setError("Choose a due date.");
    setError("");
    onSubmit(g);
  }
  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Goal" required full hint="Make it measurable, e.g. “Cut time-to-hire to 21 days”.">
          {(p) => <input {...p} data-autofocus value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />}
        </Field>
        <Field label="Owner" required>
          {(p) => <input {...p} value={g.ownerName} onChange={(e) => setG({ ...g, ownerName: e.target.value })} placeholder="Person or team" />}
        </Field>
        <Field label="Area">
          {(p) => (
            <select {...p} value={g.department} onChange={(e) => setG({ ...g, department: e.target.value as GoalDepartment })}>
              {GOAL_DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Due date" required>
          {(p) => <input {...p} type="date" value={g.dueDate} onChange={(e) => setG({ ...g, dueDate: e.target.value })} />}
        </Field>
      </div>
      {error ? (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Create goal
        </button>
      </div>
    </form>
  );
}

export function PerformanceView() {
  const { state, act, can, now, todayIso } = usePeople();
  const toast = useToast();
  const [showGoal, setShowGoal] = useState(false);
  const cycle = now ? `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}` : null;
  const people = state.employees.filter((e) => e.status === "Active");
  const cycleReviews = cycle ? state.reviews.filter((r) => r.cycle === cycle) : [];
  const completed = cycleReviews.filter((r) => r.status === "Completed").length;
  const avg = state.goals.length ? Math.round(state.goals.reduce((n, g) => n + g.progress, 0) / state.goals.length) : 0;
  const soon = todayIso ? state.goals.filter((g) => g.progress < 100 && g.dueDate >= todayIso && g.dueDate <= new Date(Date.parse(todayIso) + 30 * 86400000).toISOString().slice(0, 10)).length : 0;
  const editGoals = can("goal/progress");
  const editReviews = can("review/set");

  function expected(g: (typeof state.goals)[number]): number {
    if (!now) return 0;
    const start = Date.parse(g.createdAt);
    const end = Date.parse(`${g.dueDate}T23:59:59Z`);
    if (!(end > start)) return 100;
    return Math.max(0, Math.min(100, Math.round(((now.getTime() - start) / (end - start)) * 100)));
  }

  return (
    <>
      <PageHeader
        eyebrow="GROW WITH PURPOSE"
        title="Performance"
        intro="Clear goals, regular reviews, and progress everyone can see."
        actions={
          can("goal/add") ? (
            <button type="button" className="btn primary" onClick={() => setShowGoal(true)}>
              <Icon name="plus" size={15} /> New goal
            </button>
          ) : null
        }
      />
      <div className="stats">
        <StatCard label="Goals" icon="trend" tone="orange" value={state.goals.length} foot={`${state.goals.filter((g) => g.progress >= 100).length} completed`} />
        <StatCard label="Average progress" icon="check" tone="blue" value={`${avg}%`} foot="Across all goals" />
        <StatCard label={`Reviews ${cycle ?? ""}`} icon="people" tone="green" value={`${completed}/${people.length}`} foot="Completed this cycle" />
        <StatCard label="Due in 30 days" icon="clock" tone="purple" value={soon} foot="Goals not yet finished" />
      </div>

      <Panel title="Goals" subtitle="Status compares progress with how much time has passed.">
        {state.goals.length === 0 ? (
          <EmptyState title="No goals yet">Create a few company or team goals to get started.</EmptyState>
        ) : (
          <ul className="goal-list">
            {[...state.goals]
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map((g) => {
                const exp = expected(g);
                const status = g.progress >= 100 ? "Done" : g.progress + 10 >= exp ? "On track" : "Behind";
                return (
                  <li key={g.id} className="goal">
                    <div className="goal-main">
                      <strong>{g.title}</strong>
                      <span>
                        {g.ownerName} · {g.department} · due {formatDate(`${g.dueDate}T12:00:00Z`)}
                      </span>
                      <div className="bar goal-bar" aria-hidden="true">
                        <i style={{ width: `${g.progress}%` }} />
                      </div>
                    </div>
                    <div className="goal-side">
                      <Badge tone={status === "Done" ? "ok" : status === "On track" ? "info" : "warn"}>{status}</Badge>
                      {editGoals ? (
                        <select
                          className="control"
                          aria-label={`Progress for ${g.title}`}
                          value={Math.round(g.progress / 5) * 5}
                          onChange={(e) => act({ type: "goal/progress", goalId: g.id, progress: Number(e.target.value) })}
                        >
                          {Array.from({ length: 21 }, (_, i) => i * 5).map((v) => (
                            <option key={v} value={v}>
                              {v}%
                            </option>
                          ))}
                        </select>
                      ) : (
                        <strong>{g.progress}%</strong>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>

      <Panel title={`Review cycle ${cycle ?? ""}`} subtitle={editReviews ? "Update each review as it moves along. Your name is recorded as reviewer." : "View only"}>
        {!cycle || people.length === 0 ? (
          <EmptyState title="No active employees to review" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Manager</th>
                  <th scope="col">Status</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Reviewer</th>
                </tr>
              </thead>
              <tbody>
                {people.map((e) => {
                  const r = cycleReviews.find((x) => x.employeeId === e.id);
                  const status: ReviewStatus = r?.status ?? "Not started";
                  const save = (next: Partial<{ status: ReviewStatus; rating: number | null }>) => {
                    act({
                      type: "review/set",
                      employeeId: e.id,
                      cycle,
                      status: next.status ?? status,
                      rating: next.rating !== undefined ? next.rating : (r?.rating ?? null),
                      summary: r?.summary ?? "",
                    });
                    toast(`Review updated for ${e.name}.`);
                  };
                  return (
                    <tr key={e.id}>
                      <td>
                        <span className="row-btn" style={{ cursor: "default" }}>
                          <Avatar name={e.name} />
                          <span className="person-info">
                            <strong>{e.name}</strong>
                            <span>{e.jobTitle}</span>
                          </span>
                        </span>
                      </td>
                      <td>{e.managerName || "—"}</td>
                      <td>
                        {editReviews ? (
                          <select className="control" aria-label={`Review status for ${e.name}`} value={status} onChange={(ev) => save({ status: ev.target.value as ReviewStatus })}>
                            {REVIEW_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge tone={status === "Completed" ? "ok" : "neutral"}>{status}</Badge>
                        )}
                      </td>
                      <td>
                        {editReviews ? (
                          <select className="control" aria-label={`Rating for ${e.name}`} value={r?.rating ?? ""} onChange={(ev) => save({ rating: ev.target.value ? Number(ev.target.value) : null })}>
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n} / 5
                              </option>
                            ))}
                          </select>
                        ) : r?.rating ? (
                          `${r.rating} / 5`
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{r?.reviewerName || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="stat-foot" style={{ marginTop: 10 }}>
        Ratings are set by people. MagHR never scores staff automatically. {pluralise(state.reviews.filter((r) => r.status === "Completed").length, "review")} completed across all cycles.
      </p>

      {showGoal ? (
        <Modal title="New goal" onClose={() => setShowGoal(false)}>
          <GoalForm
            onCancel={() => setShowGoal(false)}
            onSubmit={(g) => {
              act({ type: "goal/add", input: g });
              setShowGoal(false);
              toast("Goal created.");
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
