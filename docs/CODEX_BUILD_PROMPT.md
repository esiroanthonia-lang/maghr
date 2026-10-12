# AI coding prompt: build MagHR

You are helping build **MagHR**, an original HR management web app intended for the Nigerian market and potentially hosted by MyJobMag in the future. The included `maghr_prototype.html` is the visual and interaction reference. Use it as inspiration; do not copy Mesh branding or proprietary assets.

## Product direction
Build a clean, professional, responsive SaaS app with original MagHR branding: deep navy sidebar, warm orange accent, white cards, muted grey page background, clear typography, accessible controls, and strong recruitment workflows.

## Phase 1 — frontend only
Use Next.js + TypeScript. First inspect `maghr_prototype.html`, then implement the UI as reusable components. Keep sample/demo data clearly labelled. Do not add a real database, authentication, external APIs, or secrets in Phase 1.

Required sections:
1. Overview dashboard: employee count, open positions, leave summary, applicants, recruitment pipeline, recent applicants, recent activity, quick actions.
2. Recruitment: job cards, search/filter, create-job form, candidate pipeline, stage updates, candidate profile summary, interview scheduling UI, offer status, and a talent-pool view.
3. Employees: searchable directory and add-employee form.
4. Leave & attendance: request list and demo approve/decline interactions.
5. Payroll & payslips: clearly labelled demo-only preview; do not claim calculations or payments are real.
6. Performance: goals and review summary.
7. Reports and settings.

## Recruitment requirements
- Pipeline stages: Applied → Screening → Shortlisted → Interview → Offer → Hired, plus Rejected and Withdrawn.
- A job vacancy has title, department, location, employment type, description, owner, status, creation date, and application count.
- A candidate has name, contact fields, applied role, CV status, current stage, notes, rating, and timestamps.
- Include a “Convert to employee” flow in the UI when a candidate is marked Hired. In Phase 1, make this a demo interaction only.
- Make candidate stage changes visible and usable; include search and filtering.
- Avoid automated decisions that reject candidates. Any AI-assisted CV summaries or scoring in future phases must be explainable, reviewed by humans, and not make final hiring decisions.

## Engineering requirements
- Use semantic HTML, keyboard-accessible forms, sensible empty states, loading/error states where appropriate, and responsive layouts.
- Keep components small and understandable. Avoid unnecessary dependencies.
- Add a README with setup commands and testing instructions.
- Add basic tests for key recruitment interactions if practical.
- Run lint/type checks and fix errors before reporting completion.
- Do not claim that code was deployed or tests passed unless you actually ran them.
- Do not expose secrets or use real personal data. Use synthetic demo data only.

## Work in small increments
First create the project structure and implement the shared shell (sidebar, top bar, responsive layout) plus Overview and Recruitment. Show the files changed and exact local run commands. Wait for review before implementing the remaining modules. Do not silently replace the product direction or remove useful interactions from the supplied prototype.
