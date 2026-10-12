-- MagHR — initial schema (Phase 2: real data)
--
-- Multi-company ("tenant") design: every business row carries org_id, and
-- row-level security (RLS) only lets signed-in members of that organisation
-- see or change it, according to their role:
--
--   hr_admin   everything in their organisation, including team management and audit log
--   recruiter  jobs, candidates, interviews, notes; read employees
--   manager    read jobs/candidates/employees; add candidate notes
--   employee   read their own employee record only
--
-- Run in Supabase: Dashboard → SQL Editor → paste and run, or `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Organisations and memberships
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  leave_allowance_days int not null default 20 check (leave_allowance_days between 0 and 60),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('hr_admin', 'recruiter', 'manager', 'employee')),
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

-- Role of the current user in an organisation (null when not a member).
-- SECURITY DEFINER so policies can call it without recursive RLS checks on memberships.
create or replace function public.member_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.memberships where org_id = p_org and user_id = auth.uid()
$$;

create or replace function public.has_role(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.member_role(p_org) = any(p_roles), false)
$$;

create or replace function public.actor_name(p_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(full_name, ''), nullif(email, ''), 'Unknown user')
  from public.memberships where org_id = p_org and user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Recruitment
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null check (char_length(trim(title)) between 3 and 120),
  department text not null check (department in ('Engineering','People Operations','Sales','Product & Design','Marketing','Finance')),
  location text not null check (char_length(trim(location)) between 1 and 120),
  employment_type text not null check (employment_type in ('Full-time','Part-time','Contract','Internship')),
  description text not null default '' check (char_length(description) <= 10000),
  owner text not null check (char_length(trim(owner)) between 1 and 120),
  status text not null default 'Draft' check (status in ('Open','Draft','Closed')),
  -- [{ "id": "...", "label": "3+ years of React" }]
  requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements) = 'array' and jsonb_array_length(requirements) <= 12),
  -- { "MyJobMag": { "status": "Live", "publishedAt": "..." } }
  channels jsonb not null default '{}'::jsonb check (jsonb_typeof(channels) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, code),
  unique (org_id, id)
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  phone text not null default '' check (char_length(phone) <= 30),
  cv_status text not null default 'Received' check (cv_status in ('Received','Reviewed','Missing')),
  stage text not null default 'Applied' check (stage in ('Applied','Screening','Shortlisted','Interview','Offer','Hired','Rejected','Withdrawn')),
  rating int not null default 0 check (rating between 0 and 5),
  offer_status text not null default 'Not started' check (offer_status in ('Not started','Draft','Sent','Accepted','Declined')),
  in_talent_pool boolean not null default false,
  converted_employee_id uuid,
  source text not null default 'Added manually' check (source in ('MyJobMag','MyJobMag CV database','Careers page','LinkedIn','WhatsApp','Referral','Added manually')),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  requirement_reviews jsonb not null default '{}'::jsonb check (jsonb_typeof(requirement_reviews) = 'object'),
  sourced_profile_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  -- A candidate can only be linked to a job in the same organisation.
  foreign key (org_id, job_id) references public.jobs(org_id, id) on delete set null (job_id)
);
create index candidates_org_job_idx on public.candidates(org_id, job_id);

create table public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  candidate_id uuid not null,
  text text not null check (char_length(trim(text)) between 1 and 4000),
  author_name text not null default '',
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (org_id, candidate_id) references public.candidates(org_id, id) on delete cascade
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  candidate_id uuid not null,
  scheduled_for timestamptz not null,
  mode text not null check (mode in ('Video call','In person','Phone')),
  interviewers text not null check (char_length(trim(interviewers)) between 1 and 300),
  location text not null default '' check (char_length(location) <= 300),
  status text not null default 'Scheduled' check (status in ('Scheduled','Completed','Cancelled')),
  created_at timestamptz not null default now(),
  foreign key (org_id, candidate_id) references public.candidates(org_id, id) on delete cascade
);

-- Append-only: written by trigger, never by the app, so the history can be trusted.
create table public.stage_history (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  candidate_id uuid not null,
  from_stage text,
  to_stage text not null,
  at timestamptz not null default now(),
  by_name text not null default '',
  by_user uuid default auth.uid(),
  foreign key (org_id, candidate_id) references public.candidates(org_id, id) on delete cascade
);
create index stage_history_candidate_idx on public.stage_history(candidate_id, at);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  department text not null check (department in ('Engineering','People Operations','Sales','Product & Design','Marketing','Finance')),
  job_title text not null check (char_length(trim(job_title)) between 1 and 120),
  location text not null default '',
  start_date date not null,
  status text not null default 'Onboarding' check (status in ('Active','Onboarding')),
  source text not null default 'Added manually' check (source in ('Seed','Converted from candidate','Added manually')),
  candidate_id uuid,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, email)
);

alter table public.candidates
  add constraint candidates_converted_employee_fk
  foreign key (org_id, converted_employee_id) references public.employees(org_id, id) on delete set null (converted_employee_id);

-- ---------------------------------------------------------------------------
-- Activity feed, self-service inbox, invitations, audit log
-- ---------------------------------------------------------------------------

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('application','stage','interview','offer','job','employee','note','publish','sourcing','whatsapp')),
  title text not null check (char_length(title) <= 200),
  detail text not null default '' check (char_length(detail) <= 400),
  at timestamptz not null default now(),
  actor uuid default auth.uid()
);
create index activity_org_at_idx on public.activity(org_id, at desc);

create table public.inbox_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null default 'WhatsApp' check (channel in ('WhatsApp')),
  from_name text not null,
  role text not null check (role in ('Employee','Candidate')),
  kind text not null check (kind in ('Leave request','Payslip request','Application status','Withdrawal')),
  detail text not null default '',
  status text not null default 'New' check (status in ('New','Approved','Declined','Sent','Answered automatically')),
  at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  role text not null check (role in ('hr_admin','recruiter','manager','employee')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid
);

-- Who changed what, when. Written only by triggers; readable by HR admins; never editable.
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  table_name text not null,
  row_id uuid,
  action text not null,
  actor uuid default auth.uid(),
  at timestamptz not null default now(),
  changes jsonb not null default '{}'::jsonb
);
create index audit_log_org_at_idx on public.audit_log(org_id, at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger candidates_touch before update on public.candidates
for each row execute function public.touch_updated_at();

-- Nobody can change their own role (stops self-promotion, and stops the last HR admin locking everyone out).
create or replace function public.guard_membership_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and old.user_id = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if new.org_id is distinct from old.org_id or new.user_id is distinct from old.user_id then
    raise exception 'Membership organisation and user cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger memberships_guard before update on public.memberships
for each row execute function public.guard_membership_role();

-- Records every stage change automatically.
create or replace function public.record_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stage_history (org_id, candidate_id, from_stage, to_stage, by_name)
    values (new.org_id, new.id, null, 'Applied', coalesce(public.actor_name(new.org_id), 'System'));
    if new.stage <> 'Applied' then
      insert into public.stage_history (org_id, candidate_id, from_stage, to_stage, by_name)
      values (new.org_id, new.id, 'Applied', new.stage, coalesce(public.actor_name(new.org_id), 'System'));
    end if;
  elsif new.stage is distinct from old.stage then
    insert into public.stage_history (org_id, candidate_id, from_stage, to_stage, by_name)
    values (new.org_id, new.id, old.stage, new.stage, coalesce(public.actor_name(new.org_id), 'System'));
  end if;
  return new;
end $$;

create trigger candidates_stage_history after insert or update of stage on public.candidates
for each row execute function public.record_stage_change();

-- Generic audit trigger: stores the changed columns only.
create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff jsonb := '{}'::jsonb;
  k text;
  o jsonb;
  n jsonb;
begin
  if tg_op = 'INSERT' then
    diff := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    diff := to_jsonb(old);
  else
    o := to_jsonb(old);
    n := to_jsonb(new);
    for k in select jsonb_object_keys(n) loop
      if k <> 'updated_at' and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;
    end if;
  end if;
  insert into public.audit_log (org_id, table_name, row_id, action, changes)
  values (
    coalesce((case when tg_op = 'DELETE' then old.org_id else new.org_id end)),
    tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end),
    lower(tg_op),
    diff
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create trigger jobs_audit after insert or update or delete on public.jobs for each row execute function public.write_audit();
create trigger candidates_audit after insert or update or delete on public.candidates for each row execute function public.write_audit();
create trigger employees_audit after insert or update or delete on public.employees for each row execute function public.write_audit();
create trigger interviews_audit after insert or update or delete on public.interviews for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Functions the app calls (RPC)
-- ---------------------------------------------------------------------------

-- Create a company workspace; the caller becomes its first HR admin.
create or replace function public.create_organization(p_name text, p_full_name text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'You already belong to a workspace' using errcode = '23505';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.organizations (name) values (trim(p_name)) returning id into v_org;
  insert into public.memberships (org_id, user_id, role, full_name, email)
  values (v_org, auth.uid(), 'hr_admin', trim(coalesce(p_full_name, '')), coalesce(v_email, ''));
  return v_org;
end $$;

-- Accept an invitation link. The signed-in email must match the invited email.
create or replace function public.accept_invitation(p_token text, p_full_name text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select * into inv from public.invitations
   where token = p_token and accepted_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'This invitation is invalid or has expired' using errcode = 'P0002';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if lower(v_email) <> lower(inv.email) then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  insert into public.memberships (org_id, user_id, role, full_name, email)
  values (inv.org_id, auth.uid(), inv.role, trim(coalesce(p_full_name, '')), v_email)
  on conflict (org_id, user_id) do update set role = excluded.role;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.org_id;
end $$;

-- Hired candidate → employee record, atomically. Runs with the caller's permissions (RLS applies).
create or replace function public.convert_candidate_to_employee(
  p_candidate uuid,
  p_department text,
  p_job_title text,
  p_location text,
  p_start_date date,
  p_employee uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  c public.candidates;
  v_emp uuid;
begin
  select * into c from public.candidates where id = p_candidate for update;
  if not found then
    raise exception 'Candidate not found' using errcode = 'P0002';
  end if;
  if c.stage <> 'Hired' then
    raise exception 'Only hired candidates can be converted' using errcode = '22023';
  end if;
  if c.converted_employee_id is not null then
    raise exception 'Candidate has already been converted' using errcode = '23505';
  end if;
  insert into public.employees (id, org_id, name, email, department, job_title, location, start_date, status, source, candidate_id)
  values (coalesce(p_employee, gen_random_uuid()), c.org_id, c.name, c.email, p_department, p_job_title, coalesce(p_location, ''), p_start_date, 'Onboarding', 'Converted from candidate', c.id)
  returning id into v_emp;
  update public.candidates set converted_employee_id = v_emp where id = c.id;
  return v_emp;
end $$;

-- Only signed-in users may call these (functions are executable by everyone by default).
revoke execute on function public.create_organization(text, text) from public, anon;
revoke execute on function public.accept_invitation(text, text) from public, anon;
revoke execute on function public.convert_candidate_to_employee(uuid, text, text, text, date, uuid) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.convert_candidate_to_employee(uuid, text, text, text, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.interviews enable row level security;
alter table public.stage_history enable row level security;
alter table public.employees enable row level security;
alter table public.activity enable row level security;
alter table public.inbox_requests enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

-- Organisations
create policy org_read on public.organizations for select to authenticated
  using (public.member_role(id) is not null);
create policy org_update on public.organizations for update to authenticated
  using (public.has_role(id, array['hr_admin'])) with check (public.has_role(id, array['hr_admin']));

-- Memberships: members see their team; only HR admins change it (and never their own role, to avoid lock-out).
create policy membership_read on public.memberships for select to authenticated
  using (public.member_role(org_id) is not null);
create policy membership_admin_update on public.memberships for update to authenticated
  using (public.has_role(org_id, array['hr_admin']) and user_id <> auth.uid())
  with check (public.has_role(org_id, array['hr_admin']));
create policy membership_admin_delete on public.memberships for delete to authenticated
  using (public.has_role(org_id, array['hr_admin']) and user_id <> auth.uid());
-- Anyone may edit their own name; the trigger below stops them changing their own role.
create policy membership_self_update on public.memberships for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Recruitment data: HR admins and recruiters write; managers read.
create policy jobs_read on public.jobs for select to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter','manager']));
create policy jobs_insert on public.jobs for insert to authenticated
  with check (public.has_role(org_id, array['hr_admin','recruiter']));
create policy jobs_update on public.jobs for update to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter']))
  with check (public.has_role(org_id, array['hr_admin','recruiter']));
create policy jobs_delete on public.jobs for delete to authenticated
  using (public.has_role(org_id, array['hr_admin']));

create policy candidates_read on public.candidates for select to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter','manager']));
create policy candidates_insert on public.candidates for insert to authenticated
  with check (public.has_role(org_id, array['hr_admin','recruiter']));
create policy candidates_update on public.candidates for update to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter']))
  with check (public.has_role(org_id, array['hr_admin','recruiter']));
create policy candidates_delete on public.candidates for delete to authenticated
  using (public.has_role(org_id, array['hr_admin']));

create policy notes_read on public.candidate_notes for select to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter','manager']));
create policy notes_insert on public.candidate_notes for insert to authenticated
  with check (public.has_role(org_id, array['hr_admin','recruiter','manager']) and author_id = auth.uid());

create policy interviews_read on public.interviews for select to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter','manager']));
create policy interviews_insert on public.interviews for insert to authenticated
  with check (public.has_role(org_id, array['hr_admin','recruiter']));
create policy interviews_update on public.interviews for update to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter']))
  with check (public.has_role(org_id, array['hr_admin','recruiter']));

create policy stage_history_read on public.stage_history for select to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter','manager']));
-- No insert/update/delete policies: only the trigger writes history.

-- Employees: HR admins manage; recruiters and managers read; employees read their own record.
create policy employees_read on public.employees for select to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter','manager']) or user_id = auth.uid());
create policy employees_insert on public.employees for insert to authenticated
  with check (public.has_role(org_id, array['hr_admin']));
create policy employees_update on public.employees for update to authenticated
  using (public.has_role(org_id, array['hr_admin']))
  with check (public.has_role(org_id, array['hr_admin']));
create policy employees_delete on public.employees for delete to authenticated
  using (public.has_role(org_id, array['hr_admin']));
-- Recruiters may create the employee record when converting a hired candidate.
create policy employees_insert_conversion on public.employees for insert to authenticated
  with check (public.has_role(org_id, array['recruiter']) and source = 'Converted from candidate' and candidate_id is not null);

create policy activity_read on public.activity for select to authenticated
  using (public.has_role(org_id, array['hr_admin','recruiter','manager']));
create policy activity_insert on public.activity for insert to authenticated
  with check (public.has_role(org_id, array['hr_admin','recruiter','manager']) and actor = auth.uid());

create policy inbox_read on public.inbox_requests for select to authenticated
  using (public.has_role(org_id, array['hr_admin']));
create policy inbox_update on public.inbox_requests for update to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));

create policy invitations_admin on public.invitations for all to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));

create policy audit_read on public.audit_log for select to authenticated
  using (public.has_role(org_id, array['hr_admin']));
