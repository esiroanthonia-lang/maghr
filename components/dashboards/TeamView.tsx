"use client";

import Link from "next/link";
import { lagosDate, lagosTime } from "@/lib/attendance";
import { formatDate, pluralise } from "@/lib/format";
import { leaveBalance, onLeaveOn, onboardingProgress } from "@/lib/people";
import { useNow } from "@/lib/store";
import { Avatar, Badge, EmptyState, PageHeader, Panel } from "../ui/bits";
import { usePeople } from "../people/usePeople";
import { useManager } from "./useManager";

/** A manager's full team: where everyone is today, their leave, review and goals. */
export function TeamView() {
  const { year } = usePeople();
  const { state, me, team } = useManager();
  const now = useNow();
  const today = now ? lagosDate(now.toISOString()) : null;
  const out = new Set((today ? onLeaveOn(state, today) : []).map((l) => l.employeeId));

  return (
    <>
      <PageHeader eyebrow="Team" title="My team" intro={me ? `${pluralise(team.length, "person", "people")} report to ${me.name}.` : "Your sign-in isn’t linked to an employee record yet."} />
      {team.length === 0 ? (
        <Panel title="Nobody here yet">
          <EmptyState title="No direct reports">HR sets who reports to whom on each employee’s job details.</EmptyState>
        </Panel>
      ) : (
        <Panel title="Direct reports" subtitle="Today’s status, leave left this year, review and goals">
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">My team</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Today</th>
                  <th scope="col">Annual leave left</th>
                  <th scope="col">Review</th>
                  <th scope="col">Goals</th>
                  <th scope="col">With us since</th>
                </tr>
              </thead>
              <tbody>
                {team.map((t) => {
                  const rec = today ? state.attendance.find((a) => a.employeeId === t.id && a.date === today) : undefined;
                  const bal = year ? leaveBalance(state, t.id, year) : null;
                  const review = state.reviews.find((r) => r.employeeId === t.id);
                  const goals = state.goals.filter((g) => g.ownerName === t.name);
                  const onb = t.status === "Onboarding" ? onboardingProgress(state, t.id) : null;
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="row-btn">
                          <Avatar name={t.name} />
                          <span className="person-info">
                            <strong>{t.name}</strong>
                            <span>{t.jobTitle}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {out.has(t.id) ? <Badge tone="info">On leave</Badge> : onb ? <Badge tone="info">Onboarding {onb.done}/{onb.total}</Badge> : rec ? <Badge tone="ok">In since {lagosTime(rec.clockIn)}</Badge> : <Badge tone="neutral">Not in yet</Badge>}
                      </td>
                      <td>{bal ? `${bal.remaining} of ${bal.allowance} days` : "—"}</td>
                      <td>{review ? <Badge tone={review.status === "Completed" ? "ok" : "info"}>{review.status}</Badge> : "—"}</td>
                      <td>{goals.length ? `${goals.length} · ${Math.round(goals.reduce((n, g) => n + g.progress, 0) / goals.length)}% done` : "—"}</td>
                      <td>{formatDate(`${t.startDate}T12:00:00Z`)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="panel-foot">
            Need to change a decision or see pay? Those stay with HR. <Link href="/performance">Open reviews and goals →</Link>
          </p>
        </Panel>
      )}
    </>
  );
}
