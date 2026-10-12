"use client";

import { useState } from "react";
import { liveChannels } from "@/lib/recruitment";
import type { Channel, Job } from "@/lib/types";
import { Notice } from "../ui/bits";
import { ChannelPicker } from "./ChannelPicker";

export function PublishForm({ job, onSubmit, onCancel }: { job: Job; onSubmit: (channels: Channel[]) => void; onCancel: () => void }) {
  const current = liveChannels(job);
  const [channels, setChannels] = useState<Channel[]>(current.length ? current : ["MyJobMag", "Careers page"]);
  const removing = current.filter((c) => !channels.includes(c));
  const adding = channels.filter((c) => !current.includes(c));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(channels);
      }}
    >
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--ink-2)" }}>
        Choose where <strong>{job.title}</strong> ({job.code}) is advertised. Every applicant is tagged with the channel they came from, so you can see which ones work.
        {job.status === "Draft" ? " Publishing will open this draft vacancy." : ""}
      </p>
      <ChannelPicker value={channels} onChange={setChannels} />
      {job.requirements.length === 0 ? (
        <div style={{ marginTop: 14 }}>
          <Notice tone="warn">This vacancy has no requirements listed, so the match panel will have nothing to show reviewers.</Notice>
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <Notice>Demo: nothing is posted for real. Live posting needs MyJobMag API approval, a LinkedIn partner integration and a WhatsApp Business account.</Notice>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={adding.length === 0 && removing.length === 0}>
          {channels.length === 0 ? "Take down all adverts" : adding.length ? `Publish to ${adding.length} channel${adding.length === 1 ? "" : "s"}` : "Update adverts"}
        </button>
      </div>
    </form>
  );
}
