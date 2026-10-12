"use client";

import { useState } from "react";
import { pluralise } from "@/lib/format";
import { useDemoStore } from "@/lib/store";
import { useUi } from "../shell/UiContext";
import { Avatar, Badge, EmptyState, Notice, Panel, RelativeTime } from "../ui/bits";

const LOCATIONS = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kaduna", "Enugu", "Remote"];

export function SourcingTab() {
  const { state, workspace } = useDemoStore();
  const { openDialog } = useUi();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [minYears, setMinYears] = useState(0);
  const [openOnly, setOpenOnly] = useState(true);

  const q = query.trim().toLowerCase();
  if (workspace.mode === "live" && state.talentDb.length === 0) {
    return (
      <Panel title="MyJobMag CV database" subtitle="Not connected yet">
        <EmptyState title="Waiting for MyJobMag API access">
          Searching the CV database from MagHR needs MyJobMag to approve API access. Only job seekers who opted in to be found will appear.
        </EmptyState>
      </Panel>
    );
  }
  const results = state.talentDb
    .filter((p) => !openOnly || p.openToWork)
    .filter((p) => p.yearsExperience >= minYears)
    .filter((p) => location === "all" || p.location.toLowerCase().includes(location.toLowerCase()))
    .filter((p) => !q || [p.name, p.headline, ...p.skills].some((v) => v.toLowerCase().includes(q)))
    // Most recently active first: a neutral order, not a ranking of quality.
    .sort((a, b) => b.lastActive.localeCompare(a.lastActive));

  const status = (profileId: string) => {
    if (state.candidates.some((c) => c.sourcedProfileId === profileId)) return <Badge tone="ok">In pipeline</Badge>;
    if (state.invitations.some((i) => i.profileId === profileId)) return <Badge tone="info">Invited</Badge>;
    return null;
  };

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Notice>
          Search the MyJobMag CV database without leaving MagHR. <strong>Demo:</strong> these are synthetic profiles. A live version needs MyJobMag API approval and must only show job seekers who opted in to being found.
        </Notice>
      </div>
      <div className="toolbar">
        <div className="filters">
          <label className="sr-only" htmlFor="tal-search">Search skills or job title</label>
          <input id="tal-search" className="control" type="search" placeholder="Skill or job title, e.g. React" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="sr-only" htmlFor="tal-loc">Location</label>
          <select id="tal-loc" className="control" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="all">Any location</option>
            {LOCATIONS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="tal-years">Minimum experience</label>
          <select id="tal-years" className="control" value={minYears} onChange={(e) => setMinYears(Number(e.target.value))}>
            <option value={0}>Any experience</option>
            <option value={1}>1+ years</option>
            <option value={3}>3+ years</option>
            <option value={5}>5+ years</option>
          </select>
          <label className="check" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open to work only
          </label>
        </div>
      </div>
      <p className="result-note" aria-live="polite">
        {pluralise(results.length, "profile")} · most recently active first
      </p>
      <Panel title="MyJobMag CV database" subtitle="Synthetic sample of opted-in job seekers">
        {results.length === 0 ? (
          <EmptyState title="No profiles match">Try a broader skill or remove a filter.</EmptyState>
        ) : (
          <ul className="list talent-list">
            {results.map((p) => (
              <li key={p.id} className="list-row">
                <Avatar name={p.name} />
                <div className="person-info">
                  <strong>
                    {p.name} {status(p.id)}
                  </strong>
                  <span>
                    {p.headline} · {pluralise(p.yearsExperience, "yr")} · {p.location} · active <RelativeTime iso={p.lastActive} />
                  </span>
                  <div className="skill-chips">
                    {p.skills.map((s) => (
                      <span key={s} className={`skill ${q && s.toLowerCase().includes(q) ? "hit" : ""}`}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <button type="button" className="btn small" onClick={() => openDialog({ type: "source", profileId: p.id })} aria-label={`Source ${p.name}`}>
                  Source
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
