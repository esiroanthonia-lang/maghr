"use client";

import { Panel } from "../ui/bits";
import { useToast } from "../ui/Toast";
import { PALETTES, setMode, setPalette, useAppearance, type Mode } from "../shell/ThemeToggle";

const MODES: [Mode, string][] = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "Match device"],
];

/** Lets each person choose the look of Membra on this device. */
export function AppearancePanel() {
  const { palette, mode } = useAppearance();
  const toast = useToast();
  return (
    <Panel title="Appearance" subtitle="Your choice, on this device. It doesn’t change what anyone else sees.">
      <div className="panel-body" style={{ display: "grid", gap: 18 }}>
        <div role="radiogroup" aria-label="Colour theme" className="palette-grid">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={palette === p.id}
              className="palette-card"
              onClick={() => {
                setPalette(p.id);
                toast(`${p.name} theme applied.`);
              }}
            >
              <span className="palette-mini" aria-hidden="true" style={{ background: p.preview.canvas }}>
                <span className="pm-side" style={{ background: p.preview.side, borderRight: `1px solid ${p.preview.line}` }}>
                  <i style={{ background: p.preview.accent }} />
                  <i style={{ background: p.preview.sideInk }} />
                  <i style={{ background: p.preview.sideInk }} />
                  <i style={{ background: p.preview.sideInk }} />
                </span>
                <span className="pm-main">
                  <span className="pm-hero" style={{ background: p.preview.hero, border: `1px solid ${p.preview.line}` }} />
                  <span className="pm-row">
                    <span className="pm-card" style={{ background: p.preview.card, border: `1px solid ${p.preview.line}` }} />
                    <span className="pm-card" style={{ background: p.preview.card, border: `1px solid ${p.preview.line}` }} />
                  </span>
                  <span className="pm-btn" style={{ background: p.preview.accent }} />
                </span>
              </span>
              <strong>
                {p.name}
                {palette === p.id ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--accent-ink)" }}>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </strong>
              <span className="desc">{p.desc}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span className="label" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }} id="mode-label">
            Mode
          </span>
          <div role="radiogroup" aria-labelledby="mode-label" className="mode-row">
            {MODES.map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
