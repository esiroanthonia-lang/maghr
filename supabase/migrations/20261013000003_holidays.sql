-- MagHR — company holidays (Eid-el-Fitr, Eid-el-Kabir, Eid-el-Maulud, substitute days, company days).
-- Fixed national holidays and Easter are calculated by the app and don't need storing.
-- Run AFTER 20261013000002_self_service.sql.

create table public.company_holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  name text not null check (char_length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (org_id, date)
);

alter table public.company_holidays enable row level security;

create policy holidays_read on public.company_holidays for select to authenticated
  using (public.member_role(org_id) is not null);
create policy holidays_admin on public.company_holidays for all to authenticated
  using (public.has_role(org_id, array['hr_admin'])) with check (public.has_role(org_id, array['hr_admin']));
