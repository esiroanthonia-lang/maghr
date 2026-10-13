-- MagHR — full employee records: personal details, next of kin, emergency contacts, education,
-- NYSC, job/contract details and guarantors; plus bank and statutory numbers kept separately.
-- Personal data under the Nigeria Data Protection Act: only HR admins and the person can see it.
-- Run AFTER 20261013000007_paye.sql.

create table public.employee_records (
  employee_id uuid primary key,
  org_id uuid not null,
  personal jsonb not null default '{}'::jsonb check (jsonb_typeof(personal) = 'object' and pg_column_size(personal) < 20000),
  job jsonb not null default '{}'::jsonb check (jsonb_typeof(job) = 'object' and pg_column_size(job) < 10000),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);

-- Staff IDs are unique within a company.
create unique index employee_records_staff_id on public.employee_records (org_id, lower(job ->> 'staffId')) where coalesce(job ->> 'staffId', '') <> '';

create table public.employee_bank (
  employee_id uuid primary key,
  org_id uuid not null,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);

-- People can update their own personal section but never the job section (staff ID, grade,
-- probation, guarantors' verification), and never move a record to someone else.
create or replace function public.guard_employee_record()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(new.org_id, array['hr_admin']) then
    if tg_op = 'INSERT' then
      if new.job <> '{}'::jsonb then
        raise exception 'Only HR admins can set job details' using errcode = '42501';
      end if;
    elsif new.job is distinct from old.job or new.org_id is distinct from old.org_id or new.employee_id is distinct from old.employee_id then
      raise exception 'Only HR admins can change job details' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger employee_records_guard before insert or update on public.employee_records
for each row execute function public.guard_employee_record();

create or replace function public.touch_employee_bank()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger employee_bank_touch before insert or update on public.employee_bank
for each row execute function public.touch_employee_bank();

-- Audit who changed what, without copying personal or bank values into the audit log.
create or replace function public.write_audit_keyed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  changed text[] := '{}';
  col text;
  sub text;
  o jsonb;
  n jsonb;
begin
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    n := to_jsonb(new);
    foreach col in array array['personal','job','data'] loop
      if n ? col and (o -> col) is distinct from (n -> col) then
        for sub in select jsonb_object_keys(coalesce(n -> col, '{}'::jsonb) || coalesce(o -> col, '{}'::jsonb)) loop
          if (o -> col -> sub) is distinct from (n -> col -> sub) then
            changed := changed || (col || '.' || sub);
          end if;
        end loop;
      end if;
    end loop;
    if cardinality(changed) = 0 then return new; end if;
  end if;
  insert into public.audit_log (org_id, table_name, row_id, action, changes)
  values (
    case when tg_op = 'DELETE' then old.org_id else new.org_id end,
    tg_table_name,
    case when tg_op = 'DELETE' then old.employee_id else new.employee_id end,
    lower(tg_op),
    jsonb_build_object('fields', to_jsonb(changed))
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger employee_records_audit after insert or update or delete on public.employee_records
for each row execute function public.write_audit_keyed();
create trigger employee_bank_audit after insert or update or delete on public.employee_bank
for each row execute function public.write_audit_keyed();

alter table public.employee_records enable row level security;
alter table public.employee_bank enable row level security;

create policy records_admin on public.employee_records for all to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));
create policy records_own_read on public.employee_records for select to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_records.employee_id and e.user_id = auth.uid()));
create policy records_own_insert on public.employee_records for insert to authenticated
  with check (exists (select 1 from public.employees e where e.id = employee_records.employee_id and e.org_id = employee_records.org_id and e.user_id = auth.uid()));
create policy records_own_update on public.employee_records for update to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_records.employee_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.employees e where e.id = employee_records.employee_id and e.user_id = auth.uid()));

create policy bank_admin on public.employee_bank for all to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));
create policy bank_own_read on public.employee_bank for select to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_bank.employee_id and e.user_id = auth.uid()));
