import Link from "next/link";
import { PageHeader, Panel } from "../ui/bits";

/** Placeholder for modules scheduled after the first review (see docs/CODEX_BUILD_PROMPT.md). */
export function ComingNext({ title, eyebrow, intro, planned }: { title: string; eyebrow: string; intro: string; planned: string[] }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} intro={intro} />
      <Panel title="Planned for the next increment" subtitle="This module is waiting for review of the Overview and Recruitment build.">
        <div className="panel-body coming">
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
            The interactive version from the original prototype will be rebuilt here as reusable components. Planned scope:
          </p>
          <ul>
            {planned.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="button-row" style={{ marginTop: 18 }}>
            <Link className="btn" href="/recruitment">
              Go to Recruitment
            </Link>
            <Link className="btn" href="/">
              Back to Overview
            </Link>
          </div>
        </div>
      </Panel>
    </>
  );
}
