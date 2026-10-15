"use client";

import { pluralise } from "@/lib/format";
import { averageTimeToHire, formatNaira, headcountByDepartment, periodLabel, toCsv } from "@/lib/people";
import { funnelCounts, sourceCounts } from "@/lib/recruitment";
import { LEAVE_TYPES } from "@/lib/types";
import { PageHeader, Panel, StatCard } from "../ui/bits";
import { BarList } from "../ui/Charts";
import { downloadText } from "../ui/download";
import { Icon } from "../ui/Icon";
import { usePeople } from "./usePeople";

function Bars({ rows, caption, format }: { rows: { label: string; value: number }[]; caption: string; format?: (n: number) => string }) {
  return <BarList data={rows} caption={caption} format={format} />;
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
                  `membra-candidates-${stamp}.csv`,
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
                  `membra-headcount-${stamp}.csv`,
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
          <Bars caption="Headcount by department" rows={headcountByDepartment(state).map((d) => ({ label: d.department, value: d.count }))} />
        </Panel>
        <Panel title="Hiring funnel" subtitle="Candidates who reached each stage">
          <Bars caption="Candidates reaching each stage" rows={funnel.map((f) => ({ label: f.stage, value: f.reached }))} />
        </Panel>
        <Panel title="Where candidates come from" subtitle="By source, all time">
          <Bars caption="Candidates by source" rows={sourceCounts(state.candidates).map((s) => ({ label: s.source, value: s.count }))} />
        </Panel>
        <Panel title={`Leave taken ${year ?? ""}`} subtitle="Approved working days by type">
          <Bars caption="Leave days taken by type" rows={leaveByType} />
        </Panel>
        {isAdmin ? (
          <Panel title="Payroll trend" subtitle="Approved gross totals, last 6 runs (HR admins only)">
            <Bars caption="Approved payroll gross by month" rows={runs.map((r) => ({ label: periodLabel(r.period), value: r.grossTotal }))} format={(n) => formatNaira(n)} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}
