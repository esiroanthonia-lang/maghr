-- Let an employee ask HR to activate Manager access for their linked team.
create table public.manager_access_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null,
  status text not null default 'Pending' check (status in ('Pending','Approved','Declined')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);

create unique index manager_access_one_pending_per_user
  on public.manager_access_requests(org_id, user_id)
  where status = 'Pending';

alter table public.manager_access_requests enable row level security;

create policy manager_access_request_read on public.manager_access_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(org_id, array['hr_admin'])
  );

create policy manager_access_request_insert on public.manager_access_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'Pending'
    and public.has_role(org_id, array['employee','manager'])
    and exists (
      select 1
      from public.employees e
      join public.memberships m on m.org_id = e.org_id
      where e.org_id = manager_access_requests.org_id
        and e.id = manager_access_requests.employee_id
        and m.user_id = auth.uid()
        and lower(trim(m.email)) = lower(trim(e.email))
        and exists (
          select 1 from public.employees report
          where report.org_id = e.org_id
            and lower(trim(report.manager_name)) = lower(trim(e.name))
            and report.status <> 'Exited'
        )
    )
  );

create or replace function public.decide_manager_access_request(p_org_id uuid, p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.manager_access_requests%rowtype;
begin
  if not public.has_role(p_org_id, array['hr_admin']) then
    raise exception 'Only HR admins can decide manager access requests';
  end if;

  select * into v_request
  from public.manager_access_requests
  where org_id = p_org_id and id = p_request_id
  for update;

  if not found or v_request.status <> 'Pending' then
    raise exception 'This request is no longer pending';
  end if;

  if v_request.user_id = auth.uid() then
    raise exception 'An HR admin cannot approve their own request';
  end if;

  if p_approve then
    if not exists (
      select 1
      from public.employees manager
      join public.employees report
        on report.org_id = manager.org_id
       and lower(trim(report.manager_name)) = lower(trim(manager.name))
       and report.status <> 'Exited'
      where manager.org_id = p_org_id
        and manager.id = v_request.employee_id
    ) then
      raise exception 'Assign at least one direct report before approving manager access';
    end if;

    update public.memberships
    set role = 'manager'
    where org_id = p_org_id and user_id = v_request.user_id;

    if not found then
      raise exception 'The employee account is no longer a workspace member';
    end if;
  end if;

  update public.manager_access_requests
  set status = case when p_approve then 'Approved' else 'Declined' end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = v_request.id;
end;
$$;

grant execute on function public.decide_manager_access_request(uuid, uuid, boolean) to authenticated;
