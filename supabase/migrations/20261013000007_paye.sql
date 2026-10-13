-- MagHR — PAYE, pension and NHF on payroll runs, and payslips.
-- The app works out each payslip from the company's payroll rules; the database locks the
-- payslips with the run once it is submitted, and staff can read only their own approved payslips.
-- Run AFTER 20261013000006_careers.sql.

-- Payroll rules (tax bands, pension and NHF rates, pay split). HR admins edit via org_update.
alter table public.organizations
  add column if not exists payroll_config jsonb not null default '{}'::jsonb check (jsonb_typeof(payroll_config) = 'object');

-- Annual rent declared by the employee, for rent relief. Same access as pay (HR admins; the person reads their own).
alter table public.employee_compensation
  add column if not exists annual_rent numeric(14,2) not null default 0 check (annual_rent >= 0 and annual_rent < 10000000000);

alter table public.payroll_runs
  add column if not exists paye_total numeric(16,2) not null default 0 check (paye_total >= 0),
  add column if not exists pension_total numeric(16,2) not null default 0 check (pension_total >= 0),
  add column if not exists nhf_total numeric(16,2) not null default 0 check (nhf_total >= 0),
  add column if not exists net_total numeric(16,2) not null default 0 check (net_total >= 0),
  add column if not exists employer_pension_total numeric(16,2) not null default 0 check (employer_pension_total >= 0);

do $$ begin
  alter table public.payroll_runs add constraint payroll_runs_org_id_id_key unique (org_id, id);
exception when duplicate_table or duplicate_object then null;
end $$;

-- Same rules as before, now also locking the deduction totals once the run leaves Draft.
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
  if old.status <> 'Draft' and (
       new.gross_total <> old.gross_total or new.employee_count <> old.employee_count
    or new.paye_total <> old.paye_total or new.pension_total <> old.pension_total or new.nhf_total <> old.nhf_total
    or new.net_total <> old.net_total or new.employer_pension_total <> old.employer_pension_total) then
    raise exception 'Return the run to Draft before changing totals' using errcode = '42501';
  end if;
  new.prepared_by := old.prepared_by;
  new.prepared_by_name := old.prepared_by_name;
  return new;
end $$;

-- Approved runs are part of the company's records and can't be deleted.
create or replace function public.guard_payroll_run_delete()
returns trigger language plpgsql as $$
begin
  if old.status = 'Approved' then
    raise exception 'An approved payroll run cannot be deleted' using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists payroll_runs_no_delete on public.payroll_runs;
create trigger payroll_runs_no_delete before delete on public.payroll_runs
for each row execute function public.guard_payroll_run_delete();

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  run_id uuid not null,
  employee_id uuid not null,
  employee_name text not null default '',
  gross numeric(14,2) not null check (gross >= 0),
  basic numeric(14,2) not null default 0 check (basic >= 0),
  housing numeric(14,2) not null default 0 check (housing >= 0),
  transport numeric(14,2) not null default 0 check (transport >= 0),
  other numeric(14,2) not null default 0,
  pension numeric(14,2) not null default 0 check (pension >= 0),
  nhf numeric(14,2) not null default 0 check (nhf >= 0),
  paye numeric(14,2) not null default 0 check (paye >= 0),
  net numeric(14,2) not null check (net >= 0),
  employer_pension numeric(14,2) not null default 0 check (employer_pension >= 0),
  rent_relief numeric(14,2) not null default 0 check (rent_relief >= 0),
  taxable numeric(16,2) not null default 0 check (taxable >= 0),
  created_at timestamptz not null default now(),
  unique (run_id, employee_id),
  -- Net must equal gross minus deductions (to the kobo).
  check (abs(gross - pension - nhf - paye - net) < 0.01),
  foreign key (org_id, run_id) references public.payroll_runs(org_id, id) on delete cascade,
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);
create index payroll_lines_run_idx on public.payroll_lines(run_id);
create index payroll_lines_employee_idx on public.payroll_lines(org_id, employee_id);

-- Payslips can only be added, changed or removed while their run is a Draft.
create or replace function public.guard_payroll_line()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  select status into v_status from public.payroll_runs where id = coalesce(new.run_id, old.run_id);
  if v_status is not null and v_status <> 'Draft' then
    raise exception 'Payslips are locked once a payroll run is submitted' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger payroll_lines_guard before insert or update or delete on public.payroll_lines
for each row execute function public.guard_payroll_line();

create trigger payroll_lines_audit after insert or update or delete on public.payroll_lines
for each row execute function public.write_audit();

alter table public.payroll_lines enable row level security;

create policy payroll_lines_admin on public.payroll_lines for all to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));

-- Staff can't read payroll_runs, so this helper answers just "is this run approved?".
create or replace function public.payroll_run_approved(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.payroll_runs where id = p_run and status = 'Approved')
$$;
revoke execute on function public.payroll_run_approved(uuid) from public, anon;
grant execute on function public.payroll_run_approved(uuid) to authenticated;

-- Staff see their own payslips, and only once the run is approved.
create policy payroll_lines_own on public.payroll_lines for select to authenticated
  using (
    exists (select 1 from public.employees e where e.id = payroll_lines.employee_id and e.user_id = auth.uid())
    and public.payroll_run_approved(payroll_lines.run_id)
  );
