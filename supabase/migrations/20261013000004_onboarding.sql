-- MagHR — onboarding checklists for new hires.
-- Only the steps are stored. Bank details, RSA PIN, TIN and ID documents are NOT stored here.
-- Run AFTER 20261013000003_holidays.sql.

create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null,
  title text not null check (char_length(trim(title)) between 3 and 160),
  owner text not null check (owner in ('HR','Manager','New hire')),
  due_date date,
  position int not null default 0,
  done_at timestamptz,
  done_by_name text not null default '',
  created_at timestamptz not null default now(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);
create index onboarding_tasks_employee_idx on public.onboarding_tasks(org_id, employee_id, position);

-- The database records who ticked a step and when; the browser can't set these.
-- New hires (anyone who isn't an HR admin or manager) may only tick or untick, nothing else.
create or replace function public.guard_onboarding_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(new.org_id, array['hr_admin','manager']) then
    if new.title is distinct from old.title or new.owner is distinct from old.owner
       or new.due_date is distinct from old.due_date or new.position is distinct from old.position
       or new.employee_id is distinct from old.employee_id or new.org_id is distinct from old.org_id then
      raise exception 'Only HR or a manager can change onboarding steps' using errcode = '42501';
    end if;
  end if;
  if new.done_at is not null and old.done_at is null then
    new.done_at := now();
    new.done_by_name := coalesce(public.actor_name(new.org_id), '');
  elsif new.done_at is null then
    new.done_by_name := '';
  else
    new.done_at := old.done_at;
    new.done_by_name := old.done_by_name;
  end if;
  return new;
end $$;

create trigger onboarding_tasks_guard before update on public.onboarding_tasks
for each row execute function public.guard_onboarding_task();

create or replace function public.stamp_onboarding_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.done_at is not null then
    new.done_at := now();
    new.done_by_name := coalesce(public.actor_name(new.org_id), '');
  else
    new.done_by_name := '';
  end if;
  return new;
end $$;

create trigger onboarding_tasks_insert before insert on public.onboarding_tasks
for each row execute function public.stamp_onboarding_insert();

create trigger onboarding_tasks_audit after insert or update or delete on public.onboarding_tasks
for each row execute function public.write_audit();

alter table public.onboarding_tasks enable row level security;

-- HR admins and managers see and manage every checklist.
create policy onboarding_staff on public.onboarding_tasks for all to authenticated
  using (public.has_role(org_id, array['hr_admin','manager']))
  with check (public.has_role(org_id, array['hr_admin','manager']));

-- A new hire sees their own checklist…
create policy onboarding_own_read on public.onboarding_tasks for select to authenticated
  using (exists (select 1 from public.employees e where e.id = onboarding_tasks.employee_id and e.user_id = auth.uid()));

-- …and ticks off only the steps marked for them.
create policy onboarding_own_tick on public.onboarding_tasks for update to authenticated
  using (owner = 'New hire' and exists (select 1 from public.employees e where e.id = onboarding_tasks.employee_id and e.user_id = auth.uid()))
  with check (owner = 'New hire' and exists (select 1 from public.employees e where e.id = onboarding_tasks.employee_id and e.user_id = auth.uid()));
