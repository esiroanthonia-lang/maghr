"use client";

import { useSyncExternalStore } from "react";

// Appearance is a per-person, per-browser preference: a palette (the overall look) and a mode
// (light, dark, or follow the device). Both live on <html> as data attributes, set before paint.

export type Theme = "light" | "dark";
export type Mode = Theme | "system";
export type Palette = "evergreen" | "clean" | "midnight" | "classic";

export const PALETTES: { id: Palette; name: string; desc: string; preview: { side: string; sideInk: string; canvas: string; card: string; hero: string; accent: string; line: string } }[] = [
  { id: "evergreen", name: "Evergreen", desc: "Deep green and brass. Calm and banking-grade.", preview: { side: "#0f2b22", sideInk: "#7a9488", canvas: "#f3f4ef", card: "#ffffff", hero: "#0f2b22", accent: "#cba35c", line: "#e2e5dd" } },
  { id: "clean", name: "Clean", desc: "White and quiet, MyJobMag orange for actions.", preview: { side: "#ffffff", sideInk: "#c9cad0", canvas: "#f7f7f8", card: "#ffffff", hero: "#ffffff", accent: "#e0602a", line: "#e8e8eb" } },
  { id: "midnight", name: "Midnight", desc: "Dark navy with violet. Bold and modern.", preview: { side: "#0a0f1e", sideInk: "#6b7593", canvas: "#f3f5fa", card: "#ffffff", hero: "#1b1f4a", accent: "#6366f1", line: "#e2e6ef" } },
  { id: "classic", name: "Classic", desc: "The original navy and orange.", preview: { side: "#10283a", sideInk: "#7f98a9", canvas: "#f3f5f7", card: "#ffffff", hero: "#10283a", accent: "#e0602a", line: "#e3e8ec" } },
];

const PALETTE_IDS = PALETTES.map((p) => p.id);
const THEME_KEY = "maghr-theme";
const PALETTE_KEY = "maghr-palette";

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette", "data-mode"] });
  return () => obs.disconnect();
};
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const readPalette = (): Palette => {
  const p = document.documentElement.dataset.palette as Palette;
  return PALETTE_IDS.includes(p) ? p : "evergreen";
};
const readMode = (): Mode => {
  const m = document.documentElement.dataset.mode;
  return m === "light" || m === "dark" ? m : "system";
};

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or storage blocked: the change still applies for this visit.
  }
}

export function setMode(mode: Mode) {
  const el = document.documentElement;
  const theme: Theme = mode === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  el.dataset.mode = mode;
  el.dataset.theme = theme;
  store(THEME_KEY, mode === "system" ? null : mode);
}

export function setPalette(p: Palette) {
  document.documentElement.dataset.palette = p;
  store(PALETTE_KEY, p);
}

export function useAppearance() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const palette = useSyncExternalStore(subscribe, readPalette, () => "evergreen" as Palette);
  const mode = useSyncExternalStore(subscribe, readMode, () => "system" as Mode);
  return { theme, palette, mode };
}

/** Switches between light and dark; the choice is remembered on this device. */
export function ThemeToggle() {
  const { theme } = useAppearance();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="icon-button theme-toggle" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => setMode(next)}>
      {theme === "dark" ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}

/** Runs before the page paints, so there's no flash of the wrong look. */
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var m=localStorage.getItem("${THEME_KEY}");var t=m;if(m!=="light"&&m!=="dark"){m="system";t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.mode=m;d.dataset.theme=t;var p=localStorage.getItem("${PALETTE_KEY}");d.dataset.palette=${JSON.stringify(PALETTE_IDS)}.indexOf(p)>-1?p:"evergreen"}catch(e){d.dataset.theme="light";d.dataset.mode="system";d.dataset.palette="evergreen"}})();`;
