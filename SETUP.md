# Going live with MagHR

This guide turns the demo into a working app with real sign-in and saved data.
It takes about 30–45 minutes. You need someone comfortable with web dashboards; no coding is required.

> **Before you put real people's data in:** finish the checklist at the end of this guide (privacy notice, NDPA review, backups). Until then, use test data only.

## What you'll set up

| Service | What it does | Cost to start |
| --- | --- | --- |
| **GitHub** | Stores the code; Vercel deploys from it | Free |
| **Supabase** | Database + sign-in | Free tier; paid plan recommended before real use (daily backups) |
| **Vercel** | Hosts the website | Free tier for testing |

Nobody needs to share passwords or secret keys with anyone, including Claude.
The only keys the app uses are the Supabase **URL** and **publishable key**, which are designed to be public. Security comes from the database rules.

---

## 1. Put the code on GitHub

1. Create a **private** repository on github.com, e.g. `maghr`.
2. Upload the contents of this folder (or push with git):
   ```bash
   git init
   git add .
   git commit -m "MagHR"
   git branch -M main
   git remote add origin https://github.com/YOUR-ORG/maghr.git
   git push -u origin main
   ```
3. The **Actions** tab will run the automatic checks (type check, lint, tests, build, database security tests). They should go green.

## 2. Create the Supabase project

1. Go to supabase.com → **New project**. Choose a region close to your users (e.g. *West EU (London)* or *Central EU (Frankfurt)*; check whether your data-protection review requires a specific region).
2. Save the database password in your company password manager.
3. Open **SQL Editor → New query**, paste the whole of `supabase/migrations/20261012000001_init.sql`, and click **Run**. You should see "Success. No rows returned". Then do the same for every other file in `supabase/migrations`, one at a time, in name order (people, self-service, holidays, onboarding…). Run each file once; when a new one is added later, run just that one.
4. **Authentication → Sign In / Providers → Email**: keep it enabled and keep **Confirm email** on.
5. **Authentication → URL Configuration**:
   - **Site URL**: your live address, e.g. `https://maghr.vercel.app`
   - **Redirect URLs**: add `https://maghr.vercel.app/**` and `http://localhost:3000/**`
6. **Project Settings → API keys**: copy the **Project URL** and the **publishable** key (starts with `sb_publishable_`). Do **not** copy the secret/service-role key anywhere.

> Supabase's built-in email sender is limited and meant for testing. Before launch, set up a proper email provider under **Authentication → Emails → SMTP settings** (e.g. Resend, Postmark, Amazon SES).

## 3. Deploy on Vercel

Your current site at maghr.vercel.app is the single preview file. Replace it with the real app:

1. In Vercel, **Add New → Project → Import** your GitHub repository. Framework preset: **Next.js** (detected automatically).
   - To keep the same address, either import into the existing `maghr` project (Settings → Git → Connect repository) or delete the old project first and name the new one `maghr`.
2. Under **Environment Variables** add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your publishable key
   - `NEXT_PUBLIC_SITE_URL` = `https://maghr.vercel.app` (or your domain)
3. Click **Deploy**.

Without these variables the site still deploys, as the demo. With them, every page requires sign-in.

## 4. First sign-in

1. Open the site → **Create an account** → confirm your email.
2. You'll be asked to **set up your workspace**: enter the company name. You become its **HR admin**.
3. Go to **Settings → Invite a teammate**, choose a role, and send them the link it creates.

| Role | Can do |
| --- | --- |
| HR admin | Everything, including team, roles and audit log |
| Recruiter | Jobs, candidates, interviews, offers, convert hires |
| Manager | View hiring pipelines, add notes |
| Employee | Their own **My space**: details, leave balance, request and cancel leave, their review, company goals |

## 5. Run it on a computer (developers)

```bash
cp .env.example .env.local   # then fill in the three values
npm install
npm run dev                  # http://localhost:3000
npm run check                # type check + lint + unit tests
npm run test:db              # database security tests (needs a local Postgres; see below)
```

`npm run test:db` runs against a **plain local Postgres**, never Supabase: set `PGHOST`, `PGPORT`, `PGUSER` (and `PGPASSWORD`) for a throwaway database server.

## What's real now, and what isn't yet

**Real:** sign-up and sign-in, company workspaces, invitations and roles, recruitment (jobs, candidates, pipeline, notes, ratings, interviews, offers, talent pool, requirement checks, convert hire to employee), activity feed, stage history and audit log.

**Still demo or not built:** MyJobMag CV database search and job posting (needs MyJobMag API approval), WhatsApp desk (needs a WhatsApp Business account), CV file uploads, emails to candidates, and the Employees, Leave, Payroll, Performance and Reports modules.

## How the data is protected

- **Company isolation:** every row belongs to a company, and database row-level security only shows it to members of that company. This is tested in `supabase/tests/rls_test.sql`.
- **Roles are checked in the database**, not just hidden in the interface.
- **Nobody can change their own role**, so no self-promotion, and the last HR admin can't lock everyone out.
- **Stage history and the audit log are written by the database itself** and can't be edited or deleted from the app.
- **The server decides timestamps and who made a change.** The browser can't fake them.
- **Hired → employee** conversion is enforced by a database function, which refuses anyone who isn't at Hired.

## Before real people's data goes in (checklist)

- [ ] Supabase on a paid plan with daily backups (or point-in-time recovery) switched on
- [ ] Custom SMTP email sender configured
- [ ] Privacy notice for candidates and employees; lawful basis and retention periods agreed (Nigeria Data Protection Act 2023)
- [ ] Data-processing agreements with Supabase and Vercel reviewed; data-hosting region approved
- [ ] At least two HR admins, using strong passwords (turn on multi-factor sign-in in Supabase when available to your plan)
- [ ] Decide who may export data, and how long rejected candidates' data is kept
- [ ] Custom domain (e.g. `maghr.myjobmag.com`) set up by whoever manages MyJobMag's DNS
