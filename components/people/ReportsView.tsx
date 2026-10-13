"use client";

import { pluralise } from "@/lib/format";
import { averageTimeToHire, formatNaira, headcountByDepartment, periodLabel, toCsv } from "@/lib/people";
import { funnelCounts, sourceCounts } from "@/lib/recruitment";
import { LEAVE_TYPES } from "@/lib/types";
import { EmptyState, PageHeader, Panel, StatCard } from "../ui/bits";
import { downloadText } from "../ui/download";
import { Icon } from "../ui/Icon";
import { usePeople } from "./usePeople";

function Bars({ rows, format = String }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <EmptyState title="No data yet" />;
  return (
    <ul className="source-bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
          </span>
          <span>{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReportsView() {
  const { state, isAdmin, year, todayIso } = usePeople();
  const active = state.employees.filter((e) => e.status !== "Exited");
  const hired = state.candidates.filter((c) => c.stage === "Hired").length;
  const tth = averageTimeToHire(state);
  const funnel = funnelCounts(state.candidates.filter((c) => c.jobId));
  const leaveByType = LEAVE_TYPES.map((t) => ({
    label: t,
    value: year ? state.leave.filter((l) => l.leaveType === t && l.status === "Approved" && l.startDate.startsWith(String(year))).reduce((n, l) => n + l.days, 0) : 0,
  })).filter((r) => r.value > 0);
  const runs = [...state.payrollRuns].filter((r) => r.status === "Approved").sort((a, b) => a.period.localeCompare(b.period)).slice(-6);
  const exitsThisYear = year ? state.employees.filter((e) => e.exitedOn?.startsWith(String(year))).length : 0;
  const turnover = active.length ? Math.round((exitsThisYear / (active.length + exitsThisYear)) * 100) : 0;
  const stamp = todayIso ?? "export";

  return (
    <>
      <PageHeader
        eyebrow="INSIGHTS FOR BETTER DECISIONS"
        title="Reports"
        intro="Live numbers from your workspace. Export any list for deeper analysis."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadText(
                  `maghr-candidates-${stamp}.csv`,
                  toCsv(
                    state.candidates.map((c) => ({
                      Name: c.name,
                      Email: c.email,
                      Role: state.jobs.find((j) => j.id === c.jobId)?.title ?? "Talent pool",
                      Stage: c.stage,
                      Source: c.source,
                      Applied: c.createdAt.slice(0, 10),
                    })),
                  ),
                )
              }
            >
              <Icon name="doc" size={15} /> Candidates CSV
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadText(
                  `maghr-headcount-${stamp}.csv`,
                  toCsv(headcountByDepartment(state).map((d) => ({ Department: d.department, Headcount: d.count }))),
                )
              }
            >
              <Icon name="doc" size={15} /> Headcount CSV
            </button>
          </>
        }
      />

      <div className="stats">
        <StatCard label="Headcount" icon="people" tone="orange" value={active.length} foot={`${state.employees.filter((e) => e.status === "Onboarding").length} onboarding`} />
        <StatCard label="Time to hire" icon="clock" tone="blue" value={tth === null ? "—" : `${tth} days`} foot={`Average across ${pluralise(hired, "hire")}`} />
        <StatCard label={`Leavers ${year ?? ""}`} icon="trend" tone="green" value={exitsThisYear} foot={`${turnover}% turnover this year`} />
        <StatCard label="Open vacancies" icon="briefcase" tone="purple" value={state.jobs.filter((j) => j.status === "Open").length} foot={`${state.candidates.filter((c) => !["Hired", "Rejected", "Withdrawn"].includes(c.stage) && c.jobId).length} active candidates`} />
      </div>

      <div className="report-grid">
        <Panel title="Headcount by department" subtitle="Current staff">
          <Bars rows={headcountByDepartment(state).map((d) => ({ label: d.department, value: d.count }))} />
        </Panel>
        <Panel title="Hiring funnel" subtitle="Candidates who reached each stage">
          <Bars rows={funnel.map((f) => ({ label: f.stage, value: f.reached }))} />
        </Panel>
        <Panel title="Where candidates come from" subtitle="By source, all time">
          <Bars rows={sourceCounts(state.candidates).map((s) => ({ label: s.source, value: s.count }))} />
        </Panel>
        <Panel title={`Leave taken ${year ?? ""}`} subtitle="Approved working days by type">
          <Bars rows={leaveByType} format={(n) => `${n}`} />
        </Panel>
        {isAdmin ? (
          <Panel title="Payroll trend" subtitle="Approved gross totals, last 6 runs (HR admins only)">
            <Bars rows={runs.map((r) => ({ label: periodLabel(r.period), value: r.grossTotal }))} format={(n) => formatNaira(n).replace(/\.00$/, "")} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}
