"use client";

import { useState, type FormEvent } from "react";
import { formatDate, pluralise } from "@/lib/format";
import type { GoalInput } from "@/lib/people";
import { DEPARTMENTS, REVIEW_STATUSES, type Department, type GoalDepartment, type Review, type ReviewStatus } from "@/lib/types";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "../ui/bits";
import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { myEmployeeEmail } from "@/lib/workspace";
import { usePeople } from "./usePeople";

function GoalForm({ employees, initialDepartment, onSubmit, onCancel }: { employees: ReturnType<typeof usePeople>["state"]["employees"]; initialDepartment?: Department; onSubmit: (g: GoalInput) => void; onCancel: () => void }) {
  const availableDepartments = Array.from(new Set(employees.map((employee) => employee.department)));
  const [g, setG] = useState<GoalInput>({ title: "", ownerName: "", department: initialDepartment ?? availableDepartments[0] ?? DEPARTMENTS[0], dueDate: "" });
  const departmentEmployees = employees.filter((employee) => employee.department === g.department);
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
        <Field label="Owner" required hint="Choose an employee from this department.">
          {(p) => <select {...p} value={g.ownerName} onChange={(e) => setG({ ...g, ownerName: e.target.value })}>
            <option value="">Choose an employee</option>
            {departmentEmployees.map((employee) => <option key={employee.id} value={employee.name}>{employee.name} · {employee.jobTitle}</option>)}
          </select>}
        </Field>
        <Field label="Department">
          {(p) => (
            <select {...p} value={g.department} onChange={(e) => setG({ ...g, department: e.target.value as GoalDepartment, ownerName: "" })}>
              {availableDepartments.map((d) => (
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
  const { state, act, can, now, todayIso, workspace, role } = usePeople();
  const toast = useToast();
  const [showGoal, setShowGoal] = useState(false);
  const [section, setSection] = useState<"goals" | "reviews">("goals");
  const [departmentFilter, setDepartmentFilter] = useState<Department | "all">(() => {
    if (role === "manager") return "all";
    const activeEmployees = state.employees.filter((employee) => employee.status === "Active");
    const ownEmail = myEmployeeEmail(workspace, role);
    const signedInEmployee = ownEmail
      ? activeEmployees.find((employee) => employee.email.trim().toLowerCase() === ownEmail.trim().toLowerCase())
      : undefined;
    return signedInEmployee?.department ?? activeEmployees[0]?.department ?? "all";
  });
  const [goalFilter, setGoalFilter] = useState<"all" | "open" | "completed">("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [editing, setEditing] = useState<{ employeeId: string; employeeName: string; review?: Review } | null>(null);
  const cycle = now ? `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}` : null;
  const people = state.employees.filter((e) => e.status === "Active");
  const isManager = role === "manager";
  const ownEmail = myEmployeeEmail(workspace, role);
  const managerProfile = isManager && ownEmail
    ? people.find((employee) => employee.email.trim().toLowerCase() === ownEmail.trim().toLowerCase())
    : undefined;
  const managedPeople = isManager && managerProfile
    ? people.filter((employee) => employee.managerName.trim().toLowerCase() === managerProfile.name.trim().toLowerCase())
    : [];
  const scopedPeople = isManager ? managedPeople : people;
  const departments = Array.from(new Set(scopedPeople.map((employee) => employee.department))).sort((a, b) => a.localeCompare(b));
  const departmentPeople = scopedPeople.filter((employee) => departmentFilter === "all" || employee.department === departmentFilter);
  const scopedEmployeeIds = new Set(departmentPeople.map((employee) => employee.id));
  const goalDepartment = (goal: (typeof state.goals)[number]): Department | null => goal.department === "Company"
    ? state.employees.find((employee) => employee.name === goal.ownerName)?.department ?? null
    : goal.department;
  const managedNames = new Set(managedPeople.map((employee) => employee.name.trim().toLowerCase()));
  const departmentGoals = state.goals.filter((goal) => {
    if (isManager && !managedNames.has(goal.ownerName.trim().toLowerCase())) return false;
    return departmentFilter === "all" || goalDepartment(goal) === departmentFilter;
  });
  const cycleReviews = cycle ? state.reviews.filter((r) => r.cycle === cycle) : [];
  const scopedReviews = state.reviews.filter((review) => scopedEmployeeIds.has(review.employeeId));
  const scopedCycleReviews = cycleReviews.filter((review) => scopedEmployeeIds.has(review.employeeId));
  const completed = departmentPeople.filter((employee) => scopedCycleReviews.some((review) => review.employeeId === employee.id && review.status === "Completed")).length;
  const inProgressReviews = departmentPeople.filter((employee) => scopedCycleReviews.some((review) => review.employeeId === employee.id && review.status !== "Not started" && review.status !== "Completed")).length;
  const notStartedReviews = Math.max(0, departmentPeople.length - completed - inProgressReviews);
  const completionRate = departmentPeople.length ? Math.round((completed / departmentPeople.length) * 100) : 0;
  const reportDepartments = departmentFilter === "all" ? departments : [departmentFilter];
  const departmentRatings = reportDepartments.map((department) => {
    const ids = new Set(scopedPeople.filter((employee) => employee.department === department).map((employee) => employee.id));
    const ratings = cycleReviews.filter((review) => ids.has(review.employeeId) && review.status === "Completed" && review.rating !== null).map((review) => review.rating as number);
    return { department, average: ratings.length ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length : null };
  });
  const topPerformers = scopedCycleReviews
    .filter((review) => review.status === "Completed" && review.rating !== null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5)
    .map((review) => ({ review, employee: state.employees.find((employee) => employee.id === review.employeeId) }))
    .filter((item): item is { review: Review; employee: (typeof state.employees)[number] } => Boolean(item.employee));
  const recentReviews = [...scopedCycleReviews]
    .filter((review) => review.status !== "Not started")
    .sort((a, b) => b.cycle.localeCompare(a.cycle))
    .slice(0, 5)
    .map((review) => ({ review, employee: state.employees.find((employee) => employee.id === review.employeeId) }))
    .filter((item): item is { review: Review; employee: (typeof state.employees)[number] } => Boolean(item.employee));
  const avg = departmentGoals.length ? Math.round(departmentGoals.reduce((n, g) => n + g.progress, 0) / departmentGoals.length) : 0;
  const soon = todayIso ? departmentGoals.filter((g) => g.progress < 100 && g.dueDate >= todayIso && g.dueDate <= new Date(Date.parse(todayIso) + 30 * 86400000).toISOString().slice(0, 10)).length : 0;
  const editGoals = can("goal/progress");
  const editReviews = can("review/set");
  const completedGoals = departmentGoals.filter((g) => g.progress >= 100).length;
  const overdueGoals = todayIso ? departmentGoals.filter((g) => g.progress < 100 && g.dueDate < todayIso).length : 0;
  const visibleGoals = [...departmentGoals]
    .filter((g) => goalFilter === "all" || (goalFilter === "completed" ? g.progress >= 100 : g.progress < 100))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const visiblePeople = departmentPeople.filter((employee) => {
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
        intro={isManager ? "Review progress, goals, and ratings for your direct reports." : "Track goal progress, review completion, and ratings by department."}
        actions={
          can("goal/add") ? (
            <button type="button" className="btn primary" onClick={() => setShowGoal(true)}>
              <Icon name="plus" size={15} /> New goal
            </button>
          ) : null
        }
      />
      <h2 className="performance-admin-heading">{isManager ? "My team performance" : "Department performance overview"}</h2>
      <Panel title={isManager ? "Your team" : "Departments"} subtitle={isManager ? "Choose one of your direct report departments, or view your whole team." : "Choose a department to see its people, goals, and review progress."}>
        <div className="performance-department-picker" aria-label="Filter performance by department">
          <button type="button" className={`btn small ${departmentFilter === "all" ? "primary" : ""}`} aria-pressed={departmentFilter === "all"} onClick={() => setDepartmentFilter("all")}>{isManager ? `My reports (${managedPeople.length})` : "All departments"}</button>
          {departments.map((department) => <button key={department} type="button" className={`btn small ${departmentFilter === department ? "primary" : ""}`} aria-pressed={departmentFilter === department} onClick={() => setDepartmentFilter(department)}>{department}<span className="count">{scopedPeople.filter((employee) => employee.department === department).length}</span></button>)}
        </div>
        <div className="performance-roster">
          <strong>{departmentFilter === "all" ? (isManager ? "Your direct reports" : "People across departments") : `People in ${departmentFilter}`}</strong>
          {departmentPeople.length ? <ul>{departmentPeople.map((employee) => <li key={employee.id}><Avatar name={employee.name} /><span><strong>{employee.name}</strong><small>{employee.jobTitle}</small></span></li>)}</ul> : <p className="stat-foot">{isManager ? "No direct reports are linked to your account yet. Ask HR to assign you as the manager on their employee profiles." : "No active employees in this department yet."}</p>}
        </div>
      </Panel>
      <div className="performance-admin-dashboard">
        <Panel title={departmentFilter === "all" ? "Performance by department" : `Performance · ${departmentFilter}`} subtitle="Average completed review ratings this cycle">
          <ul className="performance-department-bars">{departmentRatings.map(({ department, average }) => <li key={department}><span>{department}</span><div className="performance-dept-bar"><i style={{ width: average === null ? "0%" : `${(average / 5) * 100}%` }} /></div><strong>{average === null ? "—" : average.toFixed(1)}</strong></li>)}</ul>
          {!departmentRatings.some((item) => item.average !== null) ? <p className="stat-foot">Ratings appear here after reviews are completed.</p> : null}
        </Panel>
        <Panel title="Review completion" subtitle={cycle ? `Current cycle · ${cycle}` : "Current review cycle"}>
          <div className="performance-completion"><div className="performance-completion-ring" style={{ background: `conic-gradient(var(--accent) ${completionRate}%, var(--line) 0)` }}><div><strong>{completionRate}%</strong><span>Completed</span></div></div><ul><li><i className="completion-dot done" />Completed <strong>{completed}</strong></li><li><i className="completion-dot progress" />In progress <strong>{inProgressReviews}</strong></li><li><i className="completion-dot pending" />Not started <strong>{notStartedReviews}</strong></li></ul></div>
        </Panel>
        <Panel title="Top performers" subtitle="Highest completed ratings in the selected department">
          {topPerformers.length ? <ol className="performance-top-list">{topPerformers.map(({ review, employee }, index) => <li key={review.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><Avatar name={employee.name} /><span className="performance-top-person"><strong>{employee.name}</strong><small>{employee.jobTitle}</small></span><strong className="performance-score">{review.rating?.toFixed(1)}</strong></li>)}</ol> : <p className="stat-foot">Top performers will appear after rated reviews are completed.</p>}
        </Panel>
        <Panel title="Recent reviews" subtitle="Latest review activity for this department">
          {recentReviews.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Employee</th><th scope="col">Cycle</th><th scope="col">Rating</th><th scope="col">Status</th></tr></thead><tbody>{recentReviews.map(({ review, employee }) => <tr key={review.id}><td><span className="row-btn" style={{ cursor: "default" }}><Avatar name={employee.name} /><span className="person-info"><strong>{employee.name}</strong><span>{employee.department}</span></span></span></td><td>{review.cycle}</td><td>{review.rating ? `${review.rating} / 5` : "—"}</td><td><Badge tone={review.status === "Completed" ? "ok" : "neutral"}>{review.status}</Badge></td></tr>)}</tbody></table></div> : <p className="stat-foot">Reviews will appear here when a manager starts a review.</p>}
        </Panel>
      </div>
      <div className="stats">
        <StatCard label="Goals" icon="trend" tone="orange" value={departmentGoals.length} foot={`${completedGoals} completed${overdueGoals ? ` · ${overdueGoals} overdue` : ""}`} />
        <StatCard label="Average progress" icon="check" tone="blue" value={`${avg}%`} foot={departmentFilter === "all" ? "Across all departments" : `For ${departmentFilter}`} />
        <StatCard label={`Reviews ${cycle ?? ""}`} icon="people" tone="green" value={`${completed}/${departmentPeople.length}`} foot="Completed this cycle" />
        <StatCard label="Due in 30 days" icon="clock" tone="purple" value={soon} foot="Goals not yet finished" />
      </div>

      <div className="tabs performance-tabs" role="tablist" aria-label="Performance sections">
        <button type="button" role="tab" aria-selected={section === "goals"} className="tab" onClick={() => setSection("goals")}>Goals <span className="count">{departmentGoals.length}</span></button>
        <button type="button" role="tab" aria-selected={section === "reviews"} className="tab" onClick={() => setSection("reviews")}>Reviews <span className="count">{departmentPeople.length}</span></button>
      </div>

      {section === "goals" ? <Panel title="Goals" subtitle="Status compares progress with how much time has passed.">
        <div className="performance-toolbar">
          <div className="performance-filters" aria-label="Filter goals">
            {(["all", "open", "completed"] as const).map((filter) => (
              <button key={filter} type="button" className={`btn small ${goalFilter === filter ? "primary" : ""}`} aria-pressed={goalFilter === filter} onClick={() => setGoalFilter(filter)}>
                {filter === "all" ? `All (${departmentGoals.length})` : filter === "open" ? `In progress (${departmentGoals.length - completedGoals})` : `Completed (${completedGoals})`}
              </button>
            ))}
          </div>
        </div>
        {departmentGoals.length === 0 ? (
          <EmptyState title="No goals for this department">Create a department goal to get started.</EmptyState>
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
                        {g.ownerName} · {goalDepartment(g) ?? "Department not set"} · due {formatDate(`${g.dueDate}T12:00:00Z`)}
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
          <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Employee</th><th scope="col">Manager</th><th scope="col">Status</th><th scope="col">Rating</th><th scope="col">Reviewer</th><th scope="col">Self-appraisal</th><th scope="col">Manager notes</th>{editReviews ? <th scope="col">Action</th> : null}</tr></thead><tbody>
            {visiblePeople.map((employee) => {
              const review = cycleReviews.find((item) => item.employeeId === employee.id);
              const status = review?.status ?? "Not started";
              return <tr key={employee.id}><td><span className="row-btn" style={{ cursor: "default" }}><Avatar name={employee.name} /><span className="person-info"><strong>{employee.name}</strong><span>{employee.jobTitle}</span></span></span></td><td>{employee.managerName || "—"}</td><td><Badge tone={status === "Completed" ? "ok" : "neutral"}>{status}</Badge></td><td>{review?.rating ? `${review.rating} / 5` : "—"}</td><td>{review?.reviewerName || "—"}</td><td className="review-note" title={review?.selfAppraisal || undefined}>{review?.selfAppraisal || "—"}</td><td className="review-note" title={review?.summary || undefined}>{review?.summary || "—"}</td>{editReviews ? <td><button className="btn small" type="button" onClick={() => setEditing({ employeeId: employee.id, employeeName: employee.name, review })}>{review ? "Edit review" : "Start review"}</button></td> : null}</tr>;
            })}
          </tbody></table></div>
        )}
      </Panel>}

      <p className="stat-foot" style={{ marginTop: 10 }}>
        Ratings are set by people. MagHR never scores staff automatically. {pluralise(scopedReviews.filter((r) => r.status === "Completed").length, "review")} completed across the selected departments.
      </p>

      {showGoal ? (
        <Modal title="New goal" onClose={() => setShowGoal(false)}>
          <GoalForm employees={scopedPeople} initialDepartment={departmentFilter === "all" ? undefined : departmentFilter}
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
      {review?.selfAppraisal ? <div className="self-review-copy full"><strong>Employee self-appraisal</strong><p>{review.selfAppraisal}</p></div> : null}
      <Field label="Review notes" full hint="Add a short summary of the discussion and agreed next steps.">{(props) => <textarea {...props} rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} />}</Field>
    </div>
    <div className="modal-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button type="submit" className="btn primary">Save review</button></div>
  </form>;
}
