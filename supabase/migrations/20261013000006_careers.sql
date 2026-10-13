-- MagHR — public careers page.
-- Visitors never read or write tables directly. They can only call two narrow functions:
-- careers_page() returns a company's OPEN jobs (no internal fields), and submit_application()
-- adds one applicant to the pipeline after validation and rate limits. The page is OFF until
-- an HR admin turns it on in Settings.
-- Run AFTER 20261013000005_attendance.sql.

alter table public.organizations
  add column if not exists careers_enabled boolean not null default false,
  add column if not exists careers_slug text unique check (careers_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  add column if not exists careers_intro text not null default '' check (char_length(careers_intro) <= 600);

-- Only HR admins change careers settings (org_update already limits updates to HR admins).

create or replace function public.careers_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when o.id is null then null else jsonb_build_object(
    'company', o.name,
    'intro', o.careers_intro,
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id,
        'code', j.code,
        'title', j.title,
        'department', j.department,
        'location', j.location,
        'employmentType', j.employment_type,
        'description', j.description,
        'requirements', coalesce((select jsonb_agg(r ->> 'label') from jsonb_array_elements(j.requirements) r), '[]'::jsonb),
        'postedAt', j.created_at
      ) order by j.created_at desc)
      from public.jobs j
      where j.org_id = o.id and j.status = 'Open'
    ), '[]'::jsonb)
  ) end
  from (select 1) one
  left join public.organizations o on o.careers_slug = lower(p_slug) and o.careers_enabled
$$;

-- Returns 'ok', 'duplicate', 'closed', 'invalid', 'consent' or 'busy'. Never reveals anything else.
create or replace function public.submit_application(
  p_slug text,
  p_job_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_location text,
  p_years int,
  p_note text,
  p_consent boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_job record;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
begin
  select id into v_org from public.organizations where careers_slug = lower(p_slug) and careers_enabled;
  if v_org is null then return 'closed'; end if;
  select id, title, code into v_job from public.jobs where id = p_job_id and org_id = v_org and status = 'Open';
  if v_job.id is null then return 'closed'; end if;
  if not coalesce(p_consent, false) then return 'consent'; end if;
  if char_length(v_name) not between 2 and 120
     or v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 200
     or char_length(coalesce(p_phone, '')) > 30
     or char_length(coalesce(p_location, '')) > 80
     or coalesce(p_years, 0) not between 0 and 60
     or char_length(coalesce(p_note, '')) > 1500 then
    return 'invalid';
  end if;
  if exists (select 1 from public.candidates where org_id = v_org and job_id = v_job.id and lower(email) = v_email) then
    return 'duplicate';
  end if;
  -- Simple abuse limits: per applicant per day, and per company per 10 minutes.
  if (select count(*) from public.candidates where org_id = v_org and lower(email) = v_email and source = 'Careers page' and created_at > now() - interval '1 day') >= 5
     or (select count(*) from public.candidates where org_id = v_org and source = 'Careers page' and created_at > now() - interval '10 minutes') >= 30 then
    return 'busy';
  end if;

  insert into public.candidates (org_id, job_id, name, email, phone, cv_status, stage, source, profile)
  values (
    v_org, v_job.id, v_name, v_email, trim(coalesce(p_phone, '')), 'Missing', 'Applied', 'Careers page',
    jsonb_build_object(
      'headline', '', 'skills', '[]'::jsonb, 'education', '',
      'location', trim(coalesce(p_location, '')),
      'yearsExperience', coalesce(p_years, 0),
      'consentAt', now()
    )
  )
  returning id into v_id;

  if char_length(trim(coalesce(p_note, ''))) > 0 then
    insert into public.candidate_notes (org_id, candidate_id, text, author_name, author_id)
    values (v_org, v_id, 'From the applicant: ' || trim(p_note), 'Careers page', null);
  end if;
  insert into public.activity (org_id, kind, title, detail, actor)
  values (v_org, 'application', 'New application from careers page', v_name || ' · ' || v_job.title, null);
  return 'ok';
end $$;

revoke execute on function public.careers_page(text) from public;
revoke execute on function public.submit_application(text, uuid, text, text, text, text, int, text, boolean) from public;
grant execute on function public.careers_page(text) to anon, authenticated;
grant execute on function public.submit_application(text, uuid, text, text, text, text, int, text, boolean) to anon, authenticated;
