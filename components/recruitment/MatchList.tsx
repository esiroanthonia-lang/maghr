"use client";

import type { RequirementMatch } from "@/lib/matching";
import type { ReviewVerdict } from "@/lib/types";

/** Requirement-by-requirement evidence. Optional reviewer buttons; never a total score. */
export function MatchList({
  matches,
  reviews,
  onReview,
  compact,
}: {
  matches: RequirementMatch[];
  reviews?: Record<string, ReviewVerdict>;
  onReview?: (requirementId: string, verdict: ReviewVerdict | null) => void;
  compact?: boolean;
}) {
  if (matches.length === 0) return <p className="stat-foot" style={{ margin: 0 }}>This vacancy has no requirements listed.</p>;
  return (
    <ul className={`match-list ${compact ? "compact" : ""}`}>
      {matches.map((m) => {
        const verdict = reviews?.[m.requirement.id];
        return (
          <li key={m.requirement.id} className={`match ${m.status}`}>
            <span className="match-icon" aria-hidden="true">
              {m.status === "found" ? "✓" : "?"}
            </span>
            <div className="match-body">
              <strong>{m.requirement.label}</strong>
              <span className="sr-only">{m.status === "found" ? "Found on CV." : "Not found on CV."}</span>
              {!compact ? <span className="match-evidence">{m.evidence}</span> : null}
              {onReview ? (
                <div className="review-row" role="group" aria-label={`Reviewer check for ${m.requirement.label}`}>
                  <button type="button" aria-pressed={verdict === "confirmed"} onClick={() => onReview(m.requirement.id, verdict === "confirmed" ? null : "confirmed")}>
                    Confirmed
                  </button>
                  <button type="button" aria-pressed={verdict === "disputed"} onClick={() => onReview(m.requirement.id, verdict === "disputed" ? null : "disputed")}>
                    Not met
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
