// Small original stroke-icon set (no icon dependency). Decorative by default.

const PATHS = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5 16 16",
  calendar: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4",
  naira: "M7 19V5l10 14V5M4.5 10h15M4.5 14h15",
  trend: "M3.5 17.5 9.5 11.5l4 4 7-8M15 7.5h5.5V13",
  report: "M6 3.5h8.5L19 8v12.5H6zM14 3.5V8h5M9.5 17v-4M12.5 17v-6M15.5 17v-2.5",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-1.9 1.1L15 20.5h-4l-.3-2a7.6 7.6 0 0 1-1.9-1.1l-1.9.7-2-3.4 1.6-1.2a7.4 7.4 0 0 1 0-2.9L4.9 9.4l2-3.4 1.9.7a7.6 7.6 0 0 1 1.9-1.1l.3-2.1h4l.3 2.1a7.6 7.6 0 0 1 1.9 1.1l1.9-.7 2 3.4-1.6 1.2a7.4 7.4 0 0 1 0 2.9z",
  bell: "M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2.2 2.2 0 0 0 4 0",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  briefcase: "M4 8h16v11H4zM9 8V5.5h6V8M4 13h16",
  clock: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2",
  pin: "M12 20.5s6-5.4 6-10.5a6 6 0 1 0-12 0c0 5.1 6 10.5 6 10.5zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  board: "M4 5h4.5v14H4zM9.75 5h4.5v9h-4.5zM15.5 5H20v11h-4.5z",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  star: "M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  info: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.5M12 7.8h.01",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  userPlus: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5 1.5 0 2.9.4 4 1.2M18 13.5v6M15 16.5h6",
  doc: "M6.5 3.5h8L18 7v13.5H6.5zM14 3.5V7.5h4M9.5 12h5M9.5 15.5h5",
  pool: "M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 0 0-17 0zM8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0z",
  mail: "M4 6h16v12H4zM4.5 6.5l7.5 6 7.5-6",
  phone: "M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z",
  chat: "M4.5 19.5l1.2-3.6A8 8 0 1 1 8.6 18.6zM8.5 10.5h7M8.5 13.5h4.5",
  send: "M4 12l16-8-6 16-2.5-6.5zM11.5 13.5 20 4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6",
  refresh: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
