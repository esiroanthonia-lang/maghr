"use client";

import { CHANNELS, type Channel } from "@/lib/types";

export const CHANNEL_INFO: Record<Channel, { blurb: string; colour: string }> = {
  MyJobMag: { blurb: "Listed on MyJobMag and sent to matching job alerts", colour: "#e96b3a" },
  "Careers page": { blurb: "Your branded careers page on Membra", colour: "#152b3a" },
  LinkedIn: { blurb: "Shared as a LinkedIn job post", colour: "#3568d4" },
  WhatsApp: { blurb: "Shareable apply-by-WhatsApp link", colour: "#16845b" },
};

export function ChannelPicker({ value, onChange }: { value: Channel[]; onChange: (v: Channel[]) => void }) {
  return (
    <div className="channel-grid">
      {CHANNELS.map((c) => {
        const on = value.includes(c);
        return (
          <label key={c} className={`channel-option ${on ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onChange(e.target.checked ? [...value, c] : value.filter((x) => x !== c))}
            />
            <span className="channel-dot" style={{ background: CHANNEL_INFO[c].colour }} aria-hidden="true" />
            <span>
              <strong>{c}</strong>
              <small>{CHANNEL_INFO[c].blurb}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}
