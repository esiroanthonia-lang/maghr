-- MagHR — people modules: employees (extended), private pay, leave, performance, payroll runs.
-- Run AFTER 20261012000001_init.sql. Safe to run once; re-running will fail on existing objects.

-- ---------------------------------------------------------------------------
-- Employees: extra fields
-- ---------------------------------------------------------------------------
alter table public.employees
  add column if not exists phone text not null default '' check (char_length(phone) <= 30),
  add column if not exists manager_name text not null default '' check (char_length(manager_name) <= 120),
  add column if not exists employment_type text not null default 'Full-time'
    check (employment_type in ('Full-time','Part-time','Contract','Internship')),
  add column if not exists exited_on date;

alter table public.employees drop constraint if exists employees_status_check;
alter table public.employees add constraint employees_status_check
  check (status in ('Active','Onboarding','Exited'));

-- Activity feed: allow the new kinds of entry.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('application','stage','interview','offer','job','employee','note','publish','sourcing','whatsapp','leave','performance','payroll','settings'));

-- ---------------------------------------------------------------------------
-- Pay is private: kept apart from the employee record so only HR admins can read it.
-- ---------------------------------------------------------------------------
create table public.employee_compensation (
  id uuid not null default gen_random_uuid() unique,
  employee_id uuid primary key,
  org_id uuid not null,
  monthly_gross numeric(14,2) not null check (monthly_gross >= 0 and monthly_gross < 1000000000),
  currency text not null default 'NGN' check (currency in ('NGN')),
  updated_at timestamptz not null default now(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null,
  leave_type text not null check (leave_type in ('Annual','Sick','Maternity','Paternity','Compassionate','Study','Unpaid')),
  start_date date not null,
  end_date date not null,
  days int not null check (days between 1 and 120),
  reason text not null default '' check (char_length(reason) <= 1000),
  status text not null default 'Pending' check (status in ('Pending','Approved','Declined','Cancelled')),
  decided_by_name text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (end_date >= start_date),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);
create index leave_requests_org_idx on public.leave_requests(org_id, start_date);

-- ---------------------------------------------------------------------------
-- Performance
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 200),
  owner_name text not null check (char_length(trim(owner_name)) between 1 and 120),
  department text not null check (department in ('Engineering','People Operations','Sales','Product & Design','Marketing','Finance','Company')),
  due_date date not null,
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null,
  cycle text not null check (char_length(cycle) between 2 and 40),
  status text not null default 'Not started' check (status in ('Not started','Self review','Manager review','Completed')),
  rating int check (rating between 1 and 5),
  summary text not null default '' check (char_length(summary) <= 2000),
  reviewer_name text not null default '',
  updated_at timestamptz not null default now(),
  unique (org_id, employee_id, cycle),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Payroll runs (preview only: totals of gross pay; no tax calculation, no payments)
-- Two different HR admins are needed: one prepares, another approves.
-- ---------------------------------------------------------------------------
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'Draft' check (status in ('Draft','Pending approval','Approved')),
  employee_count int not null default 0 check (employee_count >= 0),
  gross_total numeric(16,2) not null default 0 check (gross_total >= 0),
  prepared_by uuid default auth.uid(),
  prepared_by_name text not null default '',
  approved_by uuid,
  approved_by_name text not null default '',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, period)
);

-- Status may only move forward, and the approver must differ from the preparer.
create or replace function public.guard_payroll_run()
returns trigger language plpgsql as $$
begin
  if new.org_id is distinct from old.org_id or new.period is distinct from old.period then
    raise exception 'Payroll period cannot be changed' using errcode = '42501';
  end if;
  if old.status = 'Approved' then
    raise exception 'An approved payroll run cannot be changed' using errcode = '42501';
  end if;
  if new.status = 'Approved' and old.status <> 'Approved' then
    if old.status <> 'Pending approval' then
      raise exception 'Submit the run for approval first' using errcode = '22023';
    end if;
    if auth.uid() is null or auth.uid() = old.prepared_by then
      raise exception 'A different HR admin must approve this payroll run' using errcode = '42501';
    end if;
    new.approved_by := auth.uid();
    new.approved_by_name := coalesce(public.actor_name(new.org_id), '');
    new.approved_at := now();
  end if;
  if new.status = 'Draft' and old.status <> 'Draft' then
    new.approved_by := null; new.approved_by_name := ''; new.approved_at := null;
  end if;
  -- Preparer and totals are fixed once the run leaves Draft.
  if old.status <> 'Draft' and (new.gross_total <> old.gross_total or new.employee_count <> old.employee_count) then
    raise exception 'Return the run to Draft before changing totals' using errcode = '42501';
  end if;
  new.prepared_by := old.prepared_by;
  new.prepared_by_name := old.prepared_by_name;
  return new;
end $$;

create trigger payroll_runs_guard before update on public.payroll_runs
for each row execute function public.guard_payroll_run();

create or replace function public.set_payroll_preparer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.prepared_by := auth.uid();
  new.prepared_by_name := coalesce(public.actor_name(new.org_id), '');
  new.status := 'Draft';
  new.approved_by := null; new.approved_by_name := ''; new.approved_at := null;
  return new;
end $$;

create trigger payroll_runs_preparer before insert on public.payroll_runs
for each row execute function public.set_payroll_preparer();

-- Leave decisions record who decided.
create or replace function public.stamp_leave_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('Approved','Declined') then
    new.decided_by_name := coalesce(public.actor_name(new.org_id), '');
    new.decided_at := now();
  end if;
  return new;
end $$;

create trigger leave_requests_decision before update on public.leave_requests
for each row execute function public.stamp_leave_decision();

-- Audit trail for the sensitive tables
create trigger employee_compensation_audit after insert or update or delete on public.employee_compensation for each row execute function public.write_audit();
create trigger leave_requests_audit after insert or update or delete on public.leave_requests for each row execute function public.write_audit();
create trigger payroll_runs_audit after insert or update or delete on public.payroll_runs for each row execute function public.write_audit();
create trigger reviews_audit after insert or update or delete on public.reviews for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.employee_compensation enable row level security;
alter table public.leave_requests enable row level security;
alter table public.goals enable row level security;
alter table public.reviews enable row level security;
alter table public.payroll_runs enable row level security;

-- Pay: HR admins only.
create policy comp_admin on public.employee_compensation for all to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));

-- Leave: HR admins and managers see and decide all; employees see and request their own.
create policy leave_read on public.leave_requests for select to authenticated
  using (
    public.has_role(org_id, array['hr_admin','manager'])
    or exists (select 1 from public.employees e where e.id = leave_requests.employee_id and e.user_id = auth.uid())
  );
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (
    status = 'Pending' and (
      public.has_role(org_id, array['hr_admin','manager'])
      or exists (select 1 from public.employees e where e.id = leave_requests.employee_id and e.org_id = leave_requests.org_id and e.user_id = auth.uid())
    )
  );
create policy leave_decide on public.leave_requests for update to authenticated
  using (public.has_role(org_id, array['hr_admin','manager']))
  with check (public.has_role(org_id, array['hr_admin','manager']));
create policy leave_cancel_own on public.leave_requests for update to authenticated
  using (status = 'Pending' and exists (select 1 from public.employees e where e.id = leave_requests.employee_id and e.user_id = auth.uid()))
  with check (status = 'Cancelled');

-- Goals: every member of the company can read; HR admins and managers edit.
create policy goals_read on public.goals for select to authenticated
  using (public.member_role(org_id) is not null);
create policy goals_write on public.goals for all to authenticated
  using (public.has_role(org_id, array['hr_admin','manager'])) with check (public.has_role(org_id, array['hr_admin','manager']));

-- Reviews: HR admins and managers; employees read their own.
create policy reviews_read on public.reviews for select to authenticated
  using (
    public.has_role(org_id, array['hr_admin','manager'])
    or exists (select 1 from public.employees e where e.id = reviews.employee_id and e.user_id = auth.uid())
  );
create policy reviews_write on public.reviews for all to authenticated
  using (public.has_role(org_id, array['hr_admin','manager'])) with check (public.has_role(org_id, array['hr_admin','manager']));

-- Payroll: HR admins only.
create policy payroll_admin on public.payroll_runs for all to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));

-- Company settings (name, leave allowance) are already editable by HR admins via org_update.
