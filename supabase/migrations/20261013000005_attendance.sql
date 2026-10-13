-- MagHR — daily attendance (clock in / clock out) and the company's usual start time.
-- Clock times always come from the database clock, never the browser.
-- Run AFTER 20261013000004_onboarding.sql.

alter table public.organizations
  add column if not exists work_start text not null default '09:00'
  check (work_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null,
  date date not null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  mode text not null default 'Office' check (mode in ('Office','Remote','Field')),
  corrected_by_name text not null default '',
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in),
  unique (org_id, employee_id, date),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);
create index attendance_org_date_idx on public.attendance(org_id, date desc);

-- Clocking in: the database sets the time and the (Lagos) date.
create or replace function public.stamp_attendance_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.clock_in := now();
  new.date := (now() at time zone 'Africa/Lagos')::date;
  new.clock_out := null;
  new.corrected_by_name := '';
  new.corrected_at := null;
  return new;
end $$;

create trigger attendance_insert before insert on public.attendance
for each row execute function public.stamp_attendance_insert();

-- Clocking out sets the time from the database clock. Only HR admins may correct times,
-- and a correction always records who made it.
create or replace function public.guard_attendance_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- The app asks for a correction by sending a new corrected_at; the database then sets the real values.
  correcting boolean := new.corrected_at is distinct from old.corrected_at and new.corrected_at is not null;
begin
  if new.org_id is distinct from old.org_id or new.employee_id is distinct from old.employee_id or new.date is distinct from old.date then
    raise exception 'Attendance records cannot be moved' using errcode = '42501';
  end if;
  if correcting then
    if not public.has_role(new.org_id, array['hr_admin']) then
      raise exception 'Only HR admins can correct attendance' using errcode = '42501';
    end if;
    new.corrected_by_name := coalesce(public.actor_name(new.org_id), 'HR admin');
    new.corrected_at := now();
    return new;
  end if;
  -- Otherwise this can only be a clock-out of an open record.
  if old.clock_out is not null or new.clock_out is null or new.clock_in is distinct from old.clock_in
     or new.mode is distinct from old.mode or new.corrected_by_name is distinct from old.corrected_by_name
     or new.corrected_at is distinct from old.corrected_at then
    raise exception 'Only HR admins can change attendance' using errcode = '42501';
  end if;
  new.clock_out := now();
  return new;
end $$;

create trigger attendance_update before update on public.attendance
for each row execute function public.guard_attendance_update();

create trigger attendance_audit after insert or update or delete on public.attendance
for each row execute function public.write_audit();

alter table public.attendance enable row level security;

-- HR admins and managers see everyone's attendance; people see their own.
create policy attendance_read on public.attendance for select to authenticated
  using (
    public.has_role(org_id, array['hr_admin','manager'])
    or exists (select 1 from public.employees e where e.id = attendance.employee_id and e.user_id = auth.uid())
  );
-- People clock in only for themselves.
create policy attendance_clock_in on public.attendance for insert to authenticated
  with check (exists (select 1 from public.employees e where e.id = attendance.employee_id and e.org_id = attendance.org_id and e.user_id = auth.uid() and e.status <> 'Exited'));
-- People clock out of their own open record; HR admins can correct any record (the trigger checks which).
create policy attendance_update on public.attendance for update to authenticated
  using (
    public.has_role(org_id, array['hr_admin'])
    or (clock_out is null and exists (select 1 from public.employees e where e.id = attendance.employee_id and e.user_id = auth.uid()))
  )
  with check (
    public.has_role(org_id, array['hr_admin'])
    or exists (select 1 from public.employees e where e.id = attendance.employee_id and e.user_id = auth.uid())
  );
create policy attendance_delete on public.attendance for delete to authenticated
  using (public.has_role(org_id, array['hr_admin']));
