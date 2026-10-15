import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Geist, Hanken_Grotesk, Inter, Sora } from "next/font/google";
import type { ReactNode } from "react";
import { THEME_BOOT_SCRIPT } from "@/components/shell/ThemeToggle";
import "./globals.css";

// Each appearance palette has its own type pairing (see globals.css). Only the default
// palette's fonts are preloaded; the others load when someone switches to them.
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--f-hanken", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--f-geist", display: "swap", preload: false });
const sora = Sora({ subsets: ["latin"], variable: "--f-sora", display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--f-inter", display: "swap", preload: false });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"], preload: false });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap", weight: ["400", "500", "600", "700"], preload: false });

export const metadata: Metadata = {
  title: { default: "Membra — People, made simpler", template: "%s · Membra" },
  description: "Membra by MyJobMag — HR and recruitment for Nigerian teams.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1411" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG" className={[hanken, geist, sora, inter, display, body].map((f) => f.variable).join(" ")} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
