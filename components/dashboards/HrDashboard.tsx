"use client";

import Link from "next/link";
import { clockedInToday, probationEnding, reviewsOpen, upcomingMoments } from "@/lib/dashboard";
import { formatDate, greeting, longDate, pluralise } from "@/lib/format";
import { formatNaira, headcountByDepartment, onLeaveOn, onboardingProgress, overdueOnboarding, periodLabel } from "@/lib/people";
import { useDemoStore, useNow } from "@/lib/store";
import { Avatar, Badge, EmptyState, Panel } from "../ui/bits";
import { Icon } from "../ui/Icon";

/** HR admin home: the state of the workforce, and what needs a decision. */
export function HrDashboard() {
  const { state, workspace } = useDemoStore();
  const now = useNow();
  const today = now ? now.toISOString().slice(0, 10) : null;
  const staff = state.employees.filter((e) => e.status !== "Exited");
  const ids = new Set(staff.map((e) => e.id));
  const outToday = today ? onLeaveOn(state, today) : [];
  const pendingLeave = state.leave.filter((l) => l.status === "Pending");
  const onboarding = staff.filter((e) => e.status === "Onboarding");
  const overdue = today ? overdueOnboarding(state, today) : [];
  const openReviews = reviewsOpen(state, ids);
  const newRequests = state.inbox.filter((r) => r.status === "New").length;
  const run = [...state.payrollRuns].sort((a, b) => b.period.localeCompare(a.period))[0];
  const moments = today ? upcomingMoments(state, today, 14).slice(0, 6) : [];
  const probation = today ? probationEnding(state, today, 30).slice(0, 5) : [];
  const clockedIn = now ? clockedInToday(state, ids, now.toISOString()).size : 0;
  const openJobs = state.jobs.filter((j) => j.status === "Open").length;
  const applicants = state.candidates.filter((c) => c.jobId && c.stage === "Applied").length;
  const firstName = workspace.mode === "live" ? workspace.me.name.split(" ")[0] : "";
  const depts = headcountByDepartment(state);
  const maxDept = Math.max(1, ...depts.map((d) => d.count));
  const nameOf = (id: string) => state.employees.find((e) => e.id === id)?.name ?? "Someone";

  const attention: { key: string; text: string; href: string; tone: "warn" | "info" }[] = [];
  if (pendingLeave.length) attention.push({ key: "leave", text: `${pluralise(pendingLeave.length, "leave request")} waiting for a decision`, href: "/leave", tone: "warn" });
  if (run && run.status === "Pending approval") attention.push({ key: "payroll", text: `${periodLabel(run.period)} payroll is waiting for approval`, href: "/payroll", tone: "warn" });
  if (overdue.length) attention.push({ key: "onb", text: `${pluralise(overdue.length, "onboarding step")} overdue`, href: "/employees", tone: "warn" });
  if (newRequests) attention.push({ key: "inbox", text: `${pluralise(newRequests, "staff request")} from WhatsApp to review`, href: "/whatsapp", tone: "info" });
  if (openReviews.length) attention.push({ key: "rev", text: `${pluralise(openReviews.length, "performance review")} not completed`, href: "/performance", tone: "info" });

  return (
    <>
      <section className="today" aria-labelledby="today-title">
        <div>
          <p className="today-date">{now ? longDate(now) : " "}</p>
          <h1 id="today-title">
            {now ? greeting(now) : "Welcome"}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <dl className="today-facts">
            <div>
              <dt>Headcount</dt>
              <dd>{staff.length}</dd>
            </div>
            <div>
              <dt>Out today</dt>
              <dd>{outToday.length}</dd>
            </div>
            <div>
              <dt>Clocked in</dt>
              <dd>{clockedIn}</dd>
            </div>
            <div>
              <dt>Leave to decide</dt>
              <dd>{pendingLeave.length}</dd>
            </div>
            <div>
              <dt>Onboarding</dt>
              <dd>{onboarding.length}</dd>
            </div>
            <div>
              <dt>Reviews open</dt>
              <dd>{openReviews.length}</dd>
            </div>
          </dl>
          <div className="today-actions">
            <Link className="btn primary" href="/employees">
              <Icon name="plus" size={15} /> Add employee
            </Link>
            <Link className="btn" href="/leave">
              Review leave
            </Link>
            <Link className="btn" href="/payroll">
              Open payroll
            </Link>
          </div>
        </div>
        <div className="today-chart">
          <h2>People by department</h2>
          <p>{pluralise(staff.length, "current employee")}</p>
          <ul className="hero-bars" aria-label="Employees by department">
            {depts.map((d) => (
              <li key={d.department}>
                <span>{d.department}</span>
                <i aria-hidden="true">
                  <b style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }} />
                </i>
                <strong>{d.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="dashboard-grid">
        <div>
          <Panel id="attention" title="Needs your attention" subtitle="Things waiting on HR">
            {attention.length === 0 ? (
              <EmptyState title="All caught up">Nothing is waiting on you right now.</EmptyState>
            ) : (
              <ul className="list">
                {attention.map((a) => (
                  <li key={a.key} className="list-row">
                    <Link className="row-btn" href={a.href}>
                      <span className="person-info">
                        <strong>{a.text}</strong>
                      </span>
                    </Link>
                    <Badge tone={a.tone}>{a.tone === "warn" ? "Act" : "Review"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            id="payroll"
            title="Payroll"
            subtitle={run ? `${periodLabel(run.period)} run` : "No payroll run yet"}
            action={
              <Link className="link-btn" href="/payroll">
                Open payroll →
              </Link>
            }
          >
            {run ? (
              <div className="panel-body hr-payroll">
                <div>
                  <span>Status</span>
                  <Badge tone={run.status === "Approved" ? "ok" : run.status === "Pending approval" ? "warn" : "neutral"}>{run.status}</Badge>
                </div>
                <div>
                  <span>People paid</span>
                  <strong>{run.employeeCount}</strong>
                </div>
                <div>
                  <span>Gross</span>
                  <strong>{formatNaira(run.grossTotal)}</strong>
                </div>
                <div>
                  <span>Net pay</span>
                  <strong>{formatNaira(run.netTotal)}</strong>
                </div>
              </div>
            ) : (
              <EmptyState title="Start your first run">Create a payroll run from the Payroll page.</EmptyState>
            )}
          </Panel>

          <Panel id="onboarding" title="New starters" subtitle="First-weeks checklists in progress">
            {onboarding.length === 0 ? (
              <EmptyState title="No one is onboarding">New hires appear here until their checklist is done.</EmptyState>
            ) : (
              <ul className="list">
                {onboarding.map((e) => {
                  const p = onboardingProgress(state, e.id);
                  return (
                    <li key={e.id} className="list-row">
                      <Link className="row-btn" href={`/employees/${e.id}`}>
                        <Avatar name={e.name} />
                        <span className="person-info">
                          <strong>{e.name}</strong>
                          <span>
                            {e.jobTitle} · starts {formatDate(`${e.startDate}T12:00:00Z`)}
                          </span>
                        </span>
                      </Link>
                      <Badge tone={p.total && p.done === p.total ? "ok" : "info"}>
                        {p.done}/{p.total} steps
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="right-stack">
          <Panel title="Coming up" subtitle="Next two weeks">
            {moments.length === 0 ? (
              <EmptyState title="Nothing coming up">Birthdays and work anniversaries show here.</EmptyState>
            ) : (
              <ul className="list">
                {moments.map((m) => (
                  <li key={`${m.employeeId}-${m.kind}`} className="list-row">
                    <span className="row-btn">
                      <Avatar name={m.name} />
                      <span className="person-info">
                        <strong>{m.name}</strong>
                        <span>
                          {m.kind === "Birthday" ? "Birthday" : `${pluralise(m.years ?? 1, "year")} with us`} · {m.inDays === 0 ? "today" : m.inDays === 1 ? "tomorrow" : `in ${m.inDays} days`}
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Probation ending" subtitle="Confirm or extend">
            {probation.length === 0 ? (
              <EmptyState title="No one due">Probation end dates in the next 30 days show here.</EmptyState>
            ) : (
              <ul className="list">
                {probation.map((p) => (
                  <li key={p.employee.id} className="list-row">
                    <Link className="row-btn" href={`/employees/${p.employee.id}`}>
                      <Avatar name={p.employee.name} />
                      <span className="person-info">
                        <strong>{p.employee.name}</strong>
                        <span>{p.inDays < 0 ? `${pluralise(-p.inDays, "day")} overdue` : p.inDays === 0 ? "Ends today" : `Ends in ${pluralise(p.inDays, "day")}`}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Out today" subtitle="Approved leave">
            {outToday.length === 0 ? (
              <EmptyState title="Everyone’s in">No approved leave today.</EmptyState>
            ) : (
              <ul className="list">
                {outToday.map((l) => (
                  <li key={l.id} className="list-row">
                    <span className="row-btn">
                      <Avatar name={nameOf(l.employeeId)} />
                      <span className="person-info">
                        <strong>{nameOf(l.employeeId)}</strong>
                        <span>
                          {l.leaveType} · back {formatDate(`${l.endDate}T12:00:00Z`)}
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Hiring snapshot" subtitle="Recruiters run this day to day">
            <div className="panel-body hr-hiring">
              <div>
                <strong>{openJobs}</strong>
                <span>open roles</span>
              </div>
              <div>
                <strong>{applicants}</strong>
                <span>new applications</span>
              </div>
              <Link className="link-btn" href="/recruitment">
                Open recruitment →
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
