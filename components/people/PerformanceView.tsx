"use client";

import { useState, type FormEvent } from "react";
import { formatDate, pluralise } from "@/lib/format";
import type { GoalInput } from "@/lib/people";
import { GOAL_DEPARTMENTS, REVIEW_STATUSES, type GoalDepartment, type Review, type ReviewStatus } from "@/lib/types";
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
  const [section, setSection] = useState<"goals" | "reviews">("goals");
  const [goalFilter, setGoalFilter] = useState<"all" | "open" | "completed">("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [editing, setEditing] = useState<{ employeeId: string; employeeName: string; review?: Review } | null>(null);
  const cycle = now ? `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}` : null;
  const people = state.employees.filter((e) => e.status === "Active");
  const cycleReviews = cycle ? state.reviews.filter((r) => r.cycle === cycle) : [];
  const completed = people.filter((employee) => cycleReviews.some((review) => review.employeeId === employee.id && review.status === "Completed")).length;
  const avg = state.goals.length ? Math.round(state.goals.reduce((n, g) => n + g.progress, 0) / state.goals.length) : 0;
  const soon = todayIso ? state.goals.filter((g) => g.progress < 100 && g.dueDate >= todayIso && g.dueDate <= new Date(Date.parse(todayIso) + 30 * 86400000).toISOString().slice(0, 10)).length : 0;
  const editGoals = can("goal/progress");
  const editReviews = can("review/set");
  const completedGoals = state.goals.filter((g) => g.progress >= 100).length;
  const overdueGoals = todayIso ? state.goals.filter((g) => g.progress < 100 && g.dueDate < todayIso).length : 0;
  const visibleGoals = [...state.goals]
    .filter((g) => goalFilter === "all" || (goalFilter === "completed" ? g.progress >= 100 : g.progress < 100))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const visiblePeople = people.filter((employee) => {
    const review = cycleReviews.find((item) => item.employeeId === employee.id);
    const status = review?.status ?? "Not started";
    const query = reviewSearch.trim().toLowerCase();
    const matchesSearch = !query || [employee.name, employee.managerName, review?.reviewerName].some((value) => value?.toLowerCase().includes(query));
    return matchesSearch && (reviewFilter === "all" || status === reviewFilter);
  });

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
        <StatCard label="Goals" icon="trend" tone="orange" value={state.goals.length} foot={`${completedGoals} completed${overdueGoals ? ` · ${overdueGoals} overdue` : ""}`} />
        <StatCard label="Average progress" icon="check" tone="blue" value={`${avg}%`} foot="Across all goals" />
        <StatCard label={`Reviews ${cycle ?? ""}`} icon="people" tone="green" value={`${completed}/${people.length}`} foot="Completed this cycle" />
        <StatCard label="Due in 30 days" icon="clock" tone="purple" value={soon} foot="Goals not yet finished" />
      </div>

      <div className="tabs performance-tabs" role="tablist" aria-label="Performance sections">
        <button type="button" role="tab" aria-selected={section === "goals"} className="tab" onClick={() => setSection("goals")}>Goals <span className="count">{state.goals.length}</span></button>
        <button type="button" role="tab" aria-selected={section === "reviews"} className="tab" onClick={() => setSection("reviews")}>Reviews <span className="count">{people.length}</span></button>
      </div>

      {section === "goals" ? <Panel title="Goals" subtitle="Status compares progress with how much time has passed.">
        <div className="performance-toolbar">
          <div className="performance-filters" aria-label="Filter goals">
            {(["all", "open", "completed"] as const).map((filter) => (
              <button key={filter} type="button" className={`btn small ${goalFilter === filter ? "primary" : ""}`} aria-pressed={goalFilter === filter} onClick={() => setGoalFilter(filter)}>
                {filter === "all" ? `All (${state.goals.length})` : filter === "open" ? `In progress (${state.goals.length - completedGoals})` : `Completed (${completedGoals})`}
              </button>
            ))}
          </div>
        </div>
        {state.goals.length === 0 ? (
          <EmptyState title="No goals yet">Create a few company or team goals to get started.</EmptyState>
        ) : visibleGoals.length === 0 ? (
          <EmptyState title="No goals in this view">Choose another filter to see more goals.</EmptyState>
        ) : (
          <ul className="goal-list">
            {visibleGoals.map((g) => {
                const exp = expected(g);
                const status = g.progress >= 100 ? "Done" : todayIso && g.dueDate < todayIso ? "Overdue" : g.progress + 10 >= exp ? "On track" : "Behind";
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
      </Panel> : <Panel title={`Review cycle ${cycle ?? ""}`} subtitle={editReviews ? "Review progress, ratings and notes for each active employee." : "View only"}>
        <div className="performance-toolbar review-toolbar">
          <label className="review-search"><Icon name="search" size={15} /><input value={reviewSearch} onChange={(event) => setReviewSearch(event.target.value)} placeholder="Search employees, managers…" aria-label="Search reviews" /></label>
          <select className="control" aria-label="Filter reviews by status" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as "all" | ReviewStatus)}>
            <option value="all">All statuses</option>{REVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
        {!cycle || people.length === 0 ? <EmptyState title="No active employees to review" /> : visiblePeople.length === 0 ? <EmptyState title="No matching reviews">Try a different search or status.</EmptyState> : (
          <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Employee</th><th scope="col">Manager</th><th scope="col">Status</th><th scope="col">Rating</th><th scope="col">Reviewer</th><th scope="col">Notes</th>{editReviews ? <th scope="col">Action</th> : null}</tr></thead><tbody>
            {visiblePeople.map((employee) => {
              const review = cycleReviews.find((item) => item.employeeId === employee.id);
              const status = review?.status ?? "Not started";
              return <tr key={employee.id}><td><span className="row-btn" style={{ cursor: "default" }}><Avatar name={employee.name} /><span className="person-info"><strong>{employee.name}</strong><span>{employee.jobTitle}</span></span></span></td><td>{employee.managerName || "—"}</td><td><Badge tone={status === "Completed" ? "ok" : "neutral"}>{status}</Badge></td><td>{review?.rating ? `${review.rating} / 5` : "—"}</td><td>{review?.reviewerName || "—"}</td><td className="review-note" title={review?.summary || undefined}>{review?.summary || "—"}</td>{editReviews ? <td><button className="btn small" type="button" onClick={() => setEditing({ employeeId: employee.id, employeeName: employee.name, review })}>{review ? "Edit review" : "Start review"}</button></td> : null}</tr>;
            })}
          </tbody></table></div>
        )}
      </Panel>}

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
      {editing ? <Modal title={`${editing.review ? "Edit" : "Start"} review · ${editing.employeeName}`} onClose={() => setEditing(null)}>
        <ReviewForm review={editing.review} onCancel={() => setEditing(null)} onSubmit={(status, rating, summary) => {
          act({ type: "review/set", employeeId: editing.employeeId, cycle: cycle!, status, rating, summary });
          toast(`Review updated for ${editing.employeeName}.`);
          setEditing(null);
        }} />
      </Modal> : null}
    </>
  );
}

function ReviewForm({ review, onSubmit, onCancel }: { review?: Review; onSubmit: (status: ReviewStatus, rating: number | null, summary: string) => void; onCancel: () => void }) {
  const [status, setStatus] = useState<ReviewStatus>(review?.status ?? "Not started");
  const [rating, setRating] = useState(review?.rating ? String(review.rating) : "");
  const [summary, setSummary] = useState(review?.summary ?? "");
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(status, rating ? Number(rating) : null, summary.trim()); }}>
    <div className="form-grid">
      <Field label="Review status">{(props) => <select {...props} value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus)}>{REVIEW_STATUSES.map((item) => <option key={item}>{item}</option>)}</select>}</Field>
      <Field label="Rating">{(props) => <select {...props} value={rating} onChange={(event) => setRating(event.target.value)}><option value="">No rating</option>{[1,2,3,4,5].map((item) => <option key={item} value={item}>{item} / 5</option>)}</select>}</Field>
      <Field label="Review notes" full hint="Add a short summary of the discussion and agreed next steps.">{(props) => <textarea {...props} rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} />}</Field>
    </div>
    <div className="modal-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button type="submit" className="btn primary">Save review</button></div>
  </form>;
}
