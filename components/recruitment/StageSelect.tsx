"use client";

import { isClosedStage } from "@/lib/recruitment";
import { useDemoStore } from "@/lib/store";
import { ALL_STAGES, type Candidate, type Stage } from "@/lib/types";
import { useUi } from "../shell/UiContext";
import { useToast } from "../ui/Toast";

/**
 * Inline stage picker used on cards and table rows.
 * Moving to Rejected/Withdrawn opens the profile instead, so a person confirms it there with a note.
 */
export function StageSelect({ candidate, compact }: { candidate: Candidate; compact?: boolean }) {
  const { act } = useDemoStore();
  const { openProfile } = useUi();
  const toast = useToast();
  return (
    <>
      <label className="sr-only" htmlFor={`stage-${candidate.id}`}>
        Stage for {candidate.name}
      </label>
      <select
        id={`stage-${candidate.id}`}
        className={compact ? undefined : "control"}
        value={candidate.stage}
        onChange={(e) => {
          const to = e.target.value as Stage;
          if (isClosedStage(to) && !isClosedStage(candidate.stage)) {
            openProfile(candidate.id);
            toast(`Confirm ${to.toLowerCase()} for ${candidate.name} in their profile.`);
            return;
          }
          act({ type: "candidate/moveStage", candidateId: candidate.id, to });
          toast(`${candidate.name} moved to ${to}.`);
        }}
      >
        {ALL_STAGES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </>
  );
}
