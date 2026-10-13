import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Display face for titles and figures; a warm, highly legible sans for the interface.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"] });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "MagHR — People, made simpler", template: "%s · MagHR" },
  description: "MagHR by MyJobMag — HR and recruitment for Nigerian teams.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10283a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
