// Explainable requirement matching.
//
// This is deliberately simple and transparent: for each requirement it looks for
// the candidate's listed CV skills, years of experience or location inside the
// requirement text, and shows the evidence it used. It produces no overall score,
// never sorts or filters candidates, and never rejects anyone. A reviewer confirms
// or disputes each line. Future AI summaries must keep these same rules.

import type { CvProfile, Requirement } from "./types";

export type MatchStatus = "found" | "not-found";

export interface RequirementMatch {
  requirement: Requirement;
  status: MatchStatus;
  evidence: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9+#. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function yearsNeeded(label: string): number | null {
  const m = label.match(/(\d+)\s*\+?\s*years?/i);
  return m ? Number(m[1]) : null;
}

function locationNeeded(label: string): string[] | null {
  const m = label.match(/(?:based|located|live)\s+(?:in|near)(?:\s+or\s+near)?\s+(.+)/i);
  if (!m) return null;
  return norm(m[1])
    .split(/\s*(?:,|\bor\b|\/)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function matchRequirement(requirement: Requirement, profile: CvProfile): RequirementMatch {
  const label = requirement.label;
  const text = norm(label);

  const years = yearsNeeded(label);
  if (years !== null) {
    if (profile.yearsExperience >= years) {
      return {
        requirement,
        status: "found",
        evidence: `CV shows ${profile.yearsExperience} year${profile.yearsExperience === 1 ? "" : "s"} of experience (needs ${years}+). Confirm it is relevant experience.`,
      };
    }
    return {
      requirement,
      status: "not-found",
      evidence: `CV shows ${profile.yearsExperience} year${profile.yearsExperience === 1 ? "" : "s"} of experience (asks for ${years}+). Ask about unlisted experience at screening.`,
    };
  }

  const places = locationNeeded(label);
  if (places) {
    const loc = norm(profile.location);
    const hit = places.find((p) => loc.includes(p));
    return hit
      ? { requirement, status: "found", evidence: `CV location: ${profile.location}.` }
      : { requirement, status: "not-found", evidence: `CV location is ${profile.location || "not given"}. Ask about relocation.` };
  }

  const hits = profile.skills.filter((skill) => {
    const s = norm(skill);
    return s.length > 1 && (text.includes(s) || s.includes(text));
  });
  if (hits.length) return { requirement, status: "found", evidence: `CV lists: ${hits.join(", ")}.` };
  return { requirement, status: "not-found", evidence: "Not mentioned on the CV. That doesn’t mean they lack it. Ask at screening." };
}

export function matchProfile(requirements: Requirement[], profile: CvProfile): RequirementMatch[] {
  return requirements.map((r) => matchRequirement(r, profile));
}

/** Parse the "one requirement per line" textarea from the job form. */
export function parseRequirementLines(text: string): string[] {
  return text
    .split(/\n|;/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 1)
    .slice(0, 12);
}
