"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { useDemoStore } from "@/lib/store";
import { Icon } from "../ui/Icon";
import { useUi } from "./UiContext";

interface Result {
  key: string;
  label: string;
  detail: string;
  run: () => void;
}

/** Searches candidates and vacancies in the demo store. */
export function GlobalSearch() {
  const { state } = useDemoStore();
  const { openProfile } = useUi();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const jobTitle = (id: string | null) => (id ? state.jobs.find((j) => j.id === id)?.title ?? "" : "Talent pool");
    const candidates = state.candidates
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 5)
      .map<Result>((c) => ({
        key: c.id,
        label: c.name,
        detail: `Candidate · ${jobTitle(c.jobId)} · ${c.stage}`,
        run: () => openProfile(c.id),
      }));
    const jobs = state.jobs
      .filter((j) => j.title.toLowerCase().includes(q) || j.code.toLowerCase().includes(q))
      .slice(0, 4)
      .map<Result>((j) => ({
        key: j.id,
        label: j.title,
        detail: `Vacancy · ${j.code} · ${j.status}`,
        run: () => router.push(`/recruitment?tab=pipeline&job=${encodeURIComponent(j.id)}`),
      }));
    return [...candidates, ...jobs];
  }, [query, state, openProfile, router]);

  function choose(r: Result) {
    r.run();
    setQuery("");
    setOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  const showList = open && query.trim().length >= 2;

  // Ctrl/⌘ + K jumps to search from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById(`${listId}-input`)?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [listId]);

  return (
    <div
      className="search-form"
      role="search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Icon name="search" size={15} />
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search candidates and jobs
      </label>
      <input
        id={`${listId}-input`}
        className="search"
        placeholder="Search people and jobs"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <span className="kbd-hint" aria-hidden="true">
        Ctrl K
      </span>
      {showList ? (
        <ul id={listId} role="listbox" className="search-results" aria-label="Search results">
          {results.length === 0 ? (
            <li className="search-empty" role="option" aria-selected={false} aria-disabled="true">
              No candidates or jobs match “{query.trim()}”
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
              >
                <strong>{r.label}</strong>
                <span>{r.detail}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
