"use client";

import { useId, useState } from "react";
import { formatDate } from "@/lib/format";
import { onboardingFor, onboardingProgress } from "@/lib/people";
import { ONBOARDING_OWNERS, type Employee, type OnboardingOwner } from "@/lib/types";
import { Avatar, Badge, Panel } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { usePeople } from "./usePeople";

const short = (iso: string) => formatDate(`${iso}T12:00:00Z`);

/**
 * A new hire's checklist. "manage" is for HR and managers (tick anything, add or remove steps);
 * "self" is the new hire's own view, where they can tick only the steps marked for them.
 */
export function OnboardingChecklist({ employee, mode }: { employee: Employee; mode: "manage" | "self" }) {
  const { state, act, can, todayIso } = usePeople();
  const toast = useToast();
  const uid = useId();
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<OnboardingOwner>("HR");
  const [due, setDue] = useState("");
  const tasks = onboardingFor(state, employee.id);
  const { done, total } = onboardingProgress(state, employee.id);
  const manage = mode === "manage" && can("onboarding/add");

  if (!total) {
    return mode === "manage" && can("onboarding/start") && employee.status !== "Exited" ? (
      <div className="onb-start">
        <p className="stat-foot" style={{ margin: 0 }}>
          No checklist yet. Start one with the usual first-weeks steps; you can add or remove steps after.
        </p>
        <button
          type="button"
          className="btn small primary"
          onClick={() => {
            act({ type: "onboarding/start", employeeId: employee.id });
            toast(`Onboarding checklist started for ${employee.name}.`);
          }}
        >
          <Icon name="check" size={14} /> Start onboarding checklist
        </button>
      </div>
    ) : (
      <p className="stat-foot" style={{ margin: 0 }}>
        No onboarding checklist.
      </p>
    );
  }

  return (
    <div className="onb">
      <div className="onb-progress">
        <div className="bar goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${done} of ${total} steps done`}>
          <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
        <span>
          {done} of {total} done
        </span>
      </div>
      <ul className="onb-list">
        {tasks.map((t) => {
          const mine = mode === "self" && t.owner === "New hire";
          const editable = mode === "manage" ? can("onboarding/toggle") : mine;
          const late = !t.doneAt && t.dueDate && todayIso && t.dueDate < todayIso;
          const id = `${uid}-${t.id}`;
          return (
            <li key={t.id} className={t.doneAt ? "is-done" : ""} data-onb-task={t.title}>
              <input
                id={id}
                type="checkbox"
                checked={Boolean(t.doneAt)}
                disabled={!editable}
                onChange={(e) => {
                  act({ type: "onboarding/toggle", taskId: t.id, done: e.target.checked });
                  if (e.target.checked && done + 1 === total) toast(`All onboarding steps done for ${employee.name}.`);
                }}
              />
              <label htmlFor={id}>
                <strong>{t.title}</strong>
                <span>
                  {t.doneAt
                    ? `Done${t.doneBy ? ` by ${t.doneBy}` : ""}, ${formatDate(t.doneAt)}`
                    : t.dueDate
                      ? `${late ? "Overdue, was due" : "Due"} ${short(t.dueDate)}`
                      : "No due date"}
                </span>
              </label>
              <Badge tone={t.owner === "New hire" ? "info" : t.owner === "Manager" ? "neutral" : "warn"}>{mode === "self" && mine ? "You" : t.owner}</Badge>
              {manage && can("onboarding/remove") ? (
                <button
                  type="button"
                  className="icon-button onb-remove"
                  aria-label={`Remove step: ${t.title}`}
                  title="Remove step"
                  onClick={() => act({ type: "onboarding/remove", taskId: t.id })}
                >
                  <Icon name="close" size={13} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {manage ? (
        <form
          className="onb-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim().length < 3) return toast("Describe the step in a few words.");
            act({ type: "onboarding/add", employeeId: employee.id, title: title.trim(), owner, dueDate: due || null });
            toast("Step added.");
            setTitle("");
            setDue("");
          }}
        >
          <label className="sr-only" htmlFor={`${uid}-title`}>
            New step
          </label>
          <input id={`${uid}-title`} className="control" placeholder="Add a step, e.g. Shadow a sales call" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <label className="sr-only" htmlFor={`${uid}-owner`}>
            Who does it
          </label>
          <select id={`${uid}-owner`} className="control" value={owner} onChange={(e) => setOwner(e.target.value as OnboardingOwner)}>
            {ONBOARDING_OWNERS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${uid}-due`}>
            Due date
          </label>
          <input id={`${uid}-due`} className="control" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button className="btn small">Add step</button>
        </form>
      ) : null}

      {mode === "manage" && done === total && employee.status === "Onboarding" && can("employee/update") ? (
        <div className="notice" style={{ marginTop: 12, alignItems: "center" }}>
          <span style={{ flex: 1 }}>Every step is done.</span>
          <button
            type="button"
            className="btn small dark"
            onClick={() => {
              const e = employee;
              const input = { name: e.name, email: e.email, phone: e.phone, department: e.department, jobTitle: e.jobTitle, location: e.location, startDate: e.startDate, managerName: e.managerName, employmentType: e.employmentType, status: "Active" as const };
              act({ type: "employee/update", employeeId: e.id, input });
              toast(`${employee.name} is now Active.`);
            }}
          >
            Mark {employee.name.split(" ")[0]} as Active
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Employees page: everyone currently onboarding, with their progress. */
export function OnboardingPanel({ onOpen }: { onOpen: (employeeId: string) => void }) {
  const { state, act, can, todayIso } = usePeople();
  const toast = useToast();
  const starters = state.employees
    .filter((e) => e.status !== "Exited" && (e.status === "Onboarding" || state.onboarding.some((t) => t.employeeId === e.id && !t.doneAt)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!starters.length) return null;

  return (
    <Panel title="Onboarding" subtitle="New starters and how far along their first-weeks checklist is">
      <ul className="list">
          {starters.map((e) => {
            const { done, total } = onboardingProgress(state, e.id);
            const late = todayIso ? state.onboarding.filter((t) => t.employeeId === e.id && !t.doneAt && t.dueDate && t.dueDate < todayIso).length : 0;
            return (
              <li key={e.id} className="list-row onb-row" data-onboarding={e.id}>
                <button type="button" className="row-btn" onClick={() => onOpen(e.id)}>
                  <Avatar name={e.name} />
                  <span className="person-info">
                    <strong>{e.name}</strong>
                    <span>
                      {e.jobTitle}, {todayIso && e.startDate > todayIso ? "starts" : "started"} {short(e.startDate)}
                    </span>
                  </span>
                </button>
                {total ? (
                  <div className="onb-row-progress">
                    <div className="bar goal-bar" aria-hidden="true">
                      <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
                    </div>
                    <span>
                      {done}/{total} steps{late ? `, ${late} overdue` : ""}
                    </span>
                  </div>
                ) : can("onboarding/start") ? (
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      act({ type: "onboarding/start", employeeId: e.id });
                      toast(`Onboarding checklist started for ${e.name}.`);
                    }}
                  >
                    Start checklist
                  </button>
                ) : (
                  <span className="stat-foot">No checklist</span>
                )}
              </li>
            );
          })}
      </ul>
    </Panel>
  );
}
