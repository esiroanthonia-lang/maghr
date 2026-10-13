"use client";

import Link from "next/link";
import { clockedInToday, pendingLeaveFor, probationEnding, reviewsOpen, upcomingMoments } from "@/lib/dashboard";
import { lagosDate, lagosTime } from "@/lib/attendance";
import { formatDate, greeting, longDate, pluralise } from "@/lib/format";
import { onLeaveOn, onboardingProgress } from "@/lib/people";
import { useNow } from "@/lib/store";
import { Avatar, Badge, EmptyState, Panel } from "../ui/bits";
import { useToast } from "../ui/Toast";
import { usePeople } from "../people/usePeople";
import { useManager } from "./useManager";

/** Manager home: my team today, and the decisions only I can make. */
export function ManagerDashboard() {
  const { act, can } = usePeople();
  const { state, me, team, ids } = useManager();
  const now = useNow();
  const toast = useToast();
  const today = now ? now.toISOString().slice(0, 10) : null;

  if (!me || team.length === 0)
    return (
      <>
        <section className="today today-compact" aria-labelledby="mgr-title">
          <div>
            <p className="today-date">{now ? longDate(now) : " "}</p>
            <h1 id="mgr-title">{now ? greeting(now) : "Welcome"}{me ? `, ${me.name.split(" ")[0]}` : ""}</h1>
          </div>
        </section>
        <Panel title="No one reports to you yet">
          <EmptyState title="Your team will appear here">
            HR sets who reports to whom on each employee’s job details. {me ? "" : "Your sign-in also needs to be linked to your employee record."}
          </EmptyState>
        </Panel>
      </>
    );

  const out = today ? onLeaveOn(state, today).filter((l) => ids.has(l.employeeId)) : [];
  const outIds = new Set(out.map((l) => l.employeeId));
  const clocked = now ? clockedInToday(state, ids, now.toISOString()) : new Set<string>();
  const pending = pendingLeaveFor(state, ids);
  const reviews = reviewsOpen(state, ids);
  const moments = today ? upcomingMoments(state, today, 14, ids).slice(0, 5) : [];
  const probation = today ? probationEnding(state, today, 45, ids) : [];
  const nameOf = (id: string) => team.find((t) => t.id === id)?.name ?? "Someone";
  const canDecide = can("leave/decide");
  const decide = (id: string, status: "Approved" | "Declined") => {
    act({ type: "leave/decide", leaveId: id, status });
    toast(status === "Approved" ? "Leave approved." : "Leave declined.");
  };

  return (
    <>
      <section className="today today-solo" aria-labelledby="mgr-title">
        <div>
          <p className="today-date">{now ? longDate(now) : " "}</p>
          <h1 id="mgr-title">
            {now ? greeting(now) : "Welcome"}, {me.name.split(" ")[0]}
          </h1>
          <dl className="today-facts">
            <div>
              <dt>Your team</dt>
              <dd>{team.length}</dd>
            </div>
            <div>
              <dt>Clocked in</dt>
              <dd>
                {clocked.size}/{team.length - out.length}
              </dd>
            </div>
            <div>
              <dt>Out today</dt>
              <dd>{out.length}</dd>
            </div>
            <div>
              <dt>Leave to decide</dt>
              <dd>{pending.length}</dd>
            </div>
            <div>
              <dt>Reviews open</dt>
              <dd>{reviews.length}</dd>
            </div>
          </dl>
          <div className="today-actions">
            <Link className="btn primary" href="/team">
              Open my team
            </Link>
            <Link className="btn" href="/performance">
              Reviews and goals
            </Link>
            <Link className="btn" href="/leave">
              Team leave calendar
            </Link>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <div>
          <Panel id="decide" title="Leave to decide" subtitle="Requests from your team">
            {pending.length === 0 ? (
              <EmptyState title="Nothing waiting">New leave requests from your team show here.</EmptyState>
            ) : (
              <ul className="list">
                {pending.map((l) => (
                  <li key={l.id} className="list-row">
                    <span className="row-btn">
                      <Avatar name={nameOf(l.employeeId)} />
                      <span className="person-info">
                        <strong>{nameOf(l.employeeId)}</strong>
                        <span>
                          {l.leaveType} · {formatDate(`${l.startDate}T12:00:00Z`)} to {formatDate(`${l.endDate}T12:00:00Z`)} · {pluralise(l.days, "working day")}
                        </span>
                      </span>
                    </span>
                    {canDecide ? (
                      <span className="button-row">
                        <button type="button" className="btn small primary" onClick={() => decide(l.id, "Approved")}>
                          Approve
                        </button>
                        <button type="button" className="btn small" onClick={() => decide(l.id, "Declined")}>
                          Decline
                        </button>
                      </span>
                    ) : (
                      <Badge tone="warn">Pending</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="today-team" title="Your team today" subtitle="Who is in, out or not yet clocked in">
            <ul className="list">
              {team.map((t) => {
                const rec = state.attendance.find((a) => a.employeeId === t.id && now && a.date === lagosDate(now.toISOString()));
                const onLeave = outIds.has(t.id);
                return (
                  <li key={t.id} className="list-row">
                    <span className="row-btn">
                      <Avatar name={t.name} />
                      <span className="person-info">
                        <strong>{t.name}</strong>
                        <span>{t.jobTitle}</span>
                      </span>
                    </span>
                    {onLeave ? <Badge tone="info">On leave</Badge> : rec ? <Badge tone="ok">In since {lagosTime(rec.clockIn)}</Badge> : <Badge tone="neutral">Not in yet</Badge>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="right-stack">
          <Panel title="Reviews to finish" subtitle="Your team’s performance reviews">
            {reviews.length === 0 ? (
              <EmptyState title="All reviews complete">Nothing outstanding for your team.</EmptyState>
            ) : (
              <ul className="list">
                {reviews.map((r) => (
                  <li key={r.id} className="list-row">
                    <Link className="row-btn" href="/performance">
                      <Avatar name={nameOf(r.employeeId)} />
                      <span className="person-info">
                        <strong>{nameOf(r.employeeId)}</strong>
                        <span>{r.cycle}</span>
                      </span>
                    </Link>
                    <Badge tone="info">{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="New starters on your team" subtitle="Your steps in their first weeks">
            {team.filter((t) => t.status === "Onboarding").length === 0 ? (
              <EmptyState title="No new starters">Anyone joining your team shows here.</EmptyState>
            ) : (
              <ul className="list">
                {team
                  .filter((t) => t.status === "Onboarding")
                  .map((t) => {
                    const p = onboardingProgress(state, t.id);
                    return (
                      <li key={t.id} className="list-row">
                        <span className="row-btn">
                          <Avatar name={t.name} />
                          <span className="person-info">
                            <strong>{t.name}</strong>
                            <span>Starts {formatDate(`${t.startDate}T12:00:00Z`)}</span>
                          </span>
                        </span>
                        <Badge tone="info">
                          {p.done}/{p.total} steps
                        </Badge>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Panel>

          {probation.length ? (
            <Panel title="Probation ending" subtitle="Tell HR whether to confirm">
              <ul className="list">
                {probation.map((p) => (
                  <li key={p.employee.id} className="list-row">
                    <span className="row-btn">
                      <Avatar name={p.employee.name} />
                      <span className="person-info">
                        <strong>{p.employee.name}</strong>
                        <span>{p.inDays < 0 ? `${pluralise(-p.inDays, "day")} overdue` : `Ends in ${pluralise(p.inDays, "day")}`}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Coming up" subtitle="Next two weeks">
            {moments.length === 0 ? (
              <EmptyState title="Nothing coming up">Anniversaries on your team show here.</EmptyState>
            ) : (
              <ul className="list">
                {moments.map((m) => (
                  <li key={`${m.employeeId}-${m.kind}`} className="list-row">
                    <span className="row-btn">
                      <Avatar name={m.name} />
                      <span className="person-info">
                        <strong>{m.name}</strong>
                        <span>
                          {m.kind === "Birthday" ? "Birthday" : `${pluralise(m.years ?? 1, "year")} with us`} · {m.inDays === 0 ? "today" : `in ${pluralise(m.inDays, "day")}`}
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
