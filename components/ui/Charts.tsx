"use client";

// Small, dependency-free charts. Single series only, one data colour (--chart),
// thin marks, hover/focus tooltips, and a visually hidden table for screen readers.

import { useId, useMemo, useState } from "react";

export interface Datum {
  label: string;
  value: number;
}

function SrTable({ caption, data, format }: { caption: string; data: Datum[]; format: (n: number) => string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <th scope="row">{d.label}</th>
            <td>{format(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Horizontal bars: magnitude by category. Value at the tip; tooltip on hover/focus. */
export function BarList({ data, caption, format = (n) => n.toLocaleString("en-NG") }: { data: Datum[]; caption: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="chart-empty">No data yet</p>;
  return (
    <figure className="barlist" aria-label={caption}>
      <SrTable caption={caption} data={data} format={format} />
      <ul aria-hidden="true">
        {data.map((d, i) => (
          <li key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? "is-hover" : undefined}>
            <span className="barlist-label">{d.label}</span>
            <span className="barlist-track">
              <i style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
            </span>
            <span className="barlist-value">{format(d.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Line + soft area over time, with crosshair tooltip. Used for weekly applications. */
export function TrendChart({
  data,
  caption,
  height = 150,
  tone = "light",
  format = (n) => n.toLocaleString("en-NG"),
}: {
  data: Datum[];
  caption: string;
  height?: number;
  tone?: "light" | "dark";
  format?: (n: number) => string;
}) {
  const id = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { t: 14, r: 14, b: 24, l: 14 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = useMemo(() => {
    const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 50 ? 10 : Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / step) * step;
  }, [max]);
  if (data.length < 2) return <p className="chart-empty">Not enough data yet</p>;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const last = data.length - 1;
  const shown = active ?? last;

  return (
    <figure className={`trend ${tone}`} aria-label={caption}>
      <SrTable caption={caption} data={data} format={format} />
      <div className="trend-tip" aria-live="polite">
        <strong>{format(data[shown].value)}</strong> <span>{data[shown].label}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="presentation"
        preserveAspectRatio="none"
        aria-hidden="true"
        onMouseLeave={() => setActive(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
          setActive(Math.max(0, Math.min(last, i)));
        }}
      >
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart)" stopOpacity={tone === "dark" ? 0.32 : 0.16} />
            <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.5, 1].map((f) => (
          <line key={f} className="trend-grid" x1={pad.l} x2={W - pad.r} y1={y(niceMax * f)} y2={y(niceMax * f)} />
        ))}
        <line className="trend-base" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
        <path d={area} fill={`url(#fill-${id})`} />
        <path d={line} className="trend-line" pathLength={1} />
        {active !== null ? <line className="trend-cross" x1={x(active)} x2={x(active)} y1={pad.t} y2={H - pad.b} /> : null}
        <circle cx={x(shown)} cy={y(data[shown].value)} r={4.5} className="trend-dot" />
      </svg>
      <div className="trend-axis" aria-hidden="true">
        <span>{data[0].label}</span>
        <span>{data[last].label}</span>
      </div>
    </figure>
  );
}
