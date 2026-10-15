# Membra

> **Two modes.** Without database settings Membra runs as a **demo** with synthetic data. With Supabase settings it becomes the **real app**, with sign-in, company workspaces, roles and saved data.
> To go live, follow **[SETUP.md](SETUP.md)**.

## Phase 2 — what's real

- Sign-up, sign-in, sign-out, email confirmation (Supabase Auth), and route protection (`proxy.ts`)
- Company workspaces: the creator becomes HR admin and invites teammates by link with a role (HR admin, recruiter, manager, employee)
- Recruitment saved to Postgres: jobs, candidates, stages, notes, ratings, interviews, offers, talent pool, requirement checks, convert hire to employee
- Database-enforced security: row-level security per company and role, tamper-proof stage history, audit log, no self-promotion (`supabase/migrations/`)
- Tests: unit (`npm test`), database security (`npm run test:db`), and GitHub Actions CI

How saving works: the browser shows a change instantly, then sends it to a server action (`app/actions/workspace.ts`). The server re-runs the same rules (`lib/recruitment.ts`) on the company's current database copy, using its own clock and the signed-in user's name, and writes only what changed (`lib/server/data.ts`). Then it returns the saved state.

---

# Phase 1 notes (frontend)

Membra is an HR management web app for the Nigerian market, built with **Next.js + TypeScript**.
This is **increment 1** of Phase 1: the shared app shell, the **Overview** dashboard and the full **Recruitment** module.
The remaining modules (Employees, Leave & attendance, Payroll, Performance, Reports, Settings) show a "planned for the next increment" page and are waiting on your review, as `docs/CODEX_BUILD_PROMPT.md` asks.

> **Demo only.** All data is synthetic (every email is `@example.com`) and lives in memory. Changes reset on refresh. Nothing is published to MyJobMag, no emails or calendar invites are sent, and there is no database, login or API.

## Where Membra is built to win

Membra won't match established HR suites such as SeamlessHR on breadth for a while. Payroll, statutory compliance, ERP integrations and mobile apps take real time. So this build leans on what MyJobMag uniquely has:

| Edge | What's in the demo | What it needs to go live |
| --- | --- | --- |
| **One-click multi-channel publishing** | Publish a vacancy to MyJobMag, the careers page, LinkedIn and WhatsApp from the job form or "Publish" on a job card. Every applicant is tagged with their source, and Overview shows which channels bring candidates. | MyJobMag API approval, LinkedIn partner integration, WhatsApp Business |
| **MyJobMag CV database sourcing** | Recruitment → **Find talent**: search by skill, location, experience and open-to-work. Then "Invite to apply" or "Add to pipeline" for an open role, with the requirement check shown first. | MyJobMag API approval; show only job seekers who opted in to being found |
| **Explainable requirement check** | Each vacancy lists requirements. A candidate's profile shows, line by line, what their CV mentions and why ("CV lists: PAYE"). There is no score, sorting or auto-rejection, and reviewers confirm or mark each line. | Structured CV data from MyJobMag profiles; any future AI summaries must follow the same rules |
| **WhatsApp desk** | A phone simulator. Candidates check their status, interview details or withdraw. Staff request leave or a payslip. Anything needing a decision lands in the HR inbox, and the decision is sent back to the chat. | WhatsApp Business Platform account, approved templates, opt-in |

Also planned as differentiators: transparent self-serve pricing and fast setup for SMEs, which reviews flag as weak spots for quote-only competitors.

## Requirements

- Node.js **20.9 or newer** (check with `node -v`)
- npm (comes with Node)

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Checks

```bash
npm run typecheck   # TypeScript, no emit
npm run lint        # ESLint with Next.js rules
npm test            # unit tests for recruitment logic (Node test runner via tsx)
npm run build       # production build
npm run check       # typecheck + lint + test in one go
```

## What's in this increment

**Shell:** navy sidebar with active state and new-application count, top bar with breadcrumb, candidate/job search (keyboard: ↑ ↓ Enter Esc), notifications summary, toasts, skip link, and a responsive layout (icon rail under 760px).

**Overview:** headcount, open positions, leave and active-applicant stats; recruitment funnel; recent applicants (click to open the profile); quick actions; upcoming interviews; live recent-activity feed.

**Recruitment** (`/recruitment`, tabs kept in the URL, e.g. `?tab=pipeline&job=job-1023`):
- **Jobs:** cards with status, code, owner, applicant count and a per-stage mini bar; search plus status and department filters; create job (validated, Open or Draft); open, close or reopen a vacancy; add a candidate straight to a role.
- **Candidate pipeline:** a board view (drag cards between columns, or use each card's stage picker for keyboard and touch) and a table view with stage filter, rating, CV status and a suggested next action.
- **Candidate profile drawer:** stage stepper, "Move to next stage", reject or withdraw (with a confirmation step; never automatic), reopen, CV status, 1–5 reviewer rating, interviews (schedule, mark done or cancel), offer status, talent-pool toggle, notes and full stage history.
- **Interviews:** upcoming, ready-to-schedule (shortlisted with nothing booked), and past or cancelled.
- **Talent pool:** candidates kept for future roles, with "Consider for an open role" to move them into a live pipeline.
- **Convert to employee:** available once a candidate is Hired. It creates an Onboarding employee record in the demo store, which the Employees module will list next.

**WhatsApp desk** (`/whatsapp`): simulator plus HR inbox. Rules: candidates only ever see their own stage in plain words (never notes or ratings), the bot approves nothing, and payslips go out as secure links, never chat attachments.

Stages: Applied → Screening → Shortlisted → Interview → Offer → Hired, plus Rejected and Withdrawn.

**Fairness:** nothing in the code rejects, ranks or advances a candidate on its own. Every stage change is an explicit action by a person, and declined offers do not change the stage.

## Project layout

```
app/                    Next.js App Router pages (one folder per module)
  layout.tsx            Root layout → AppShell
  page.tsx              Overview
  recruitment/page.tsx  Recruitment
  globals.css           Membra visual system (ported from the prototype)
components/
  shell/                Sidebar, Topbar, GlobalSearch, DialogHost, UiContext, ComingNext
  overview/             OverviewView
  recruitment/          RecruitmentView, JobsTab, PipelineBoard, CandidateTable,
                        CandidateDrawer, InterviewsTab, TalentPoolTab, forms
  ui/                   Icon, Modal (focus trap + Esc), Toast, Field, shared bits
lib/
  types.ts              Domain types (Job, Candidate, Interview, Employee…)
  demo-data.ts          Synthetic seed data
  recruitment.ts        Pure reducer + selectors (all recruitment rules live here)
  store.tsx             React context wrapping the reducer; useNow() clock hook
  format.ts             en-NG / Africa/Lagos formatting helpers
  matching.ts           Explainable requirement check (no scores)
  whatsapp.ts           Scripted WhatsApp assistant (pure functions)
components/whatsapp/    WhatsApp desk page
tests/                  recruitment.test.ts, whatsapp.test.ts
docs/                   Original prototype and build prompt (reference only)
```

All state changes go through `recruitmentReducer` in `lib/recruitment.ts`. When a backend is added, each action maps to one API call. The reducer is already pure and server-safe.

## Manual test checklist

- [ ] Every sidebar link opens the right page and the breadcrumb updates
- [ ] Create a job: empty submit shows errors; a valid job appears and Open positions goes up by one
- [ ] Add a candidate: their profile opens and they appear in Recent applicants
- [ ] Jobs search and status/department filters narrow the cards; "Clear filters" works
- [ ] "View candidates" opens the pipeline filtered to that job
- [ ] Drag a card to another column; change a stage with a card's picker
- [ ] Choosing Rejected opens the profile and asks for confirmation
- [ ] Schedule an interview from a profile; it shows on the Interviews tab and Overview
- [ ] Offer → Accepted → "move to Hired" → "Convert to employee"; headcount on Overview goes up
- [ ] Talent pool: "Consider for an open role" moves the candidate into that pipeline
- [ ] Top-bar search finds a candidate by name and opens their profile
- [ ] Esc closes dialogs and the drawer; Tab stays inside an open dialog
- [ ] Publish the draft Payroll Officer role to 3 channels; it opens and shows 3 channel chips
- [ ] Find talent → search "payroll" → Source → Add to pipeline; the profile shows source and requirement lines
- [ ] Confirm / Not met buttons toggle on each requirement line
- [ ] WhatsApp desk: as an employee, request leave (1 → 1 → 20/10 → 5 → YES); approve it in the inbox and see the reply in chat
- [ ] WhatsApp desk: as a candidate, check status, then withdraw (3 → YES); the pipeline shows Withdrawn
- [ ] At phone width (≈390px) there's no sideways page scroll
- [ ] No errors in the browser console

## Before going live (not in Phase 1)

Replace the demo store with authenticated, tenant-isolated database records; add role-based access and server-side authorisation; validate and sanitise input on the server; add audit logs, backups and secure CV upload; review Nigeria Data Protection Act (NDPA) obligations and privacy notices; get Nigerian payroll and statutory rules validated by qualified professionals; and get MyJobMag approval and API access before publishing jobs. `maghr.myjobmag.com` is a target hostname, not a configured site.
