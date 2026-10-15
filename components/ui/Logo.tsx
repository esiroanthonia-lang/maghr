// MagHR brand mark: an "M" drawn as two people side by side, the second one rising,
// a nod to people and growth. Original artwork.
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="11" fill="var(--logo-bg)" />
      <circle cx="14" cy="11.5" r="3.2" fill="var(--logo-ink)" />
      <circle cx="26.5" cy="9" r="3.2" fill="var(--logo-ink)" opacity="0.92" />
      <path d="M8.5 31V19.5c0-2 1.6-3.6 3.6-3.6h3.8c2 0 3.6 1.6 3.6 3.6V31" fill="none" stroke="var(--logo-ink)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M19.5 27V17c0-2 1.6-3.6 3.6-3.6h3.8c2 0 3.6 1.6 3.6 3.6v14" fill="none" stroke="var(--logo-ink)" strokeWidth="3.4" strokeLinecap="round" opacity="0.92" />
    </svg>
  );
}

/** The Membra logo. Two cut-outs, white and dark, so it reads on any theme; CSS picks the one that suits the surface. */
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark ${light ? "light" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo white" src="/brand/membra-white.png" alt="Membra" width={129} height={34} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo ink" src="/brand/membra-ink.png" alt="" aria-hidden="true" width={129} height={34} />
    </span>
  );
}
