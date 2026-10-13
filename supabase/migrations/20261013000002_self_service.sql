-- MagHR — staff self-service: link each login to its employee record.
-- Run AFTER 20261013000001_people.sql.

-- When an employee record is added or its email changes, link it to the member with that email.
create or replace function public.link_employee_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null or (tg_op = 'UPDATE' and new.email is distinct from old.email) then
    select m.user_id into new.user_id
    from public.memberships m
    where m.org_id = new.org_id and lower(m.email) = lower(new.email)
    limit 1;
  end if;
  return new;
end $$;

create trigger employees_link_user before insert or update of email on public.employees
for each row execute function public.link_employee_user();

-- When someone joins a workspace, link them to an existing employee record with their email.
create or replace function public.link_member_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.employees
     set user_id = new.user_id
   where org_id = new.org_id and user_id is null and lower(email) = lower(new.email);
  return new;
end $$;

create trigger memberships_link_employee after insert on public.memberships
for each row execute function public.link_member_employee();

-- Link anyone who already exists on both sides.
update public.employees e
   set user_id = m.user_id
  from public.memberships m
 where e.user_id is null and m.org_id = e.org_id and lower(m.email) = lower(e.email);

-- Employees may see their own pay figure (never anyone else's).
create policy comp_own_read on public.employee_compensation for select to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_compensation.employee_id and e.user_id = auth.uid()));
