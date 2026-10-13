-- Careers page tests: what an anonymous visitor can and cannot do.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  execute 'set role anon';
end $$;
reset role;
select org_id as acme from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a' \gset

\echo 'TEST the careers page is off until an HR admin turns it on; only HR admins can'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.jobs (org_id, code, title, department, location, employment_type, description, owner, status, requirements)
values (:'acme', 'JOB-OPEN', 'Careers Test Engineer', 'Engineering', 'Lagos', 'Full-time', 'Build things', 'Ada', 'Open', '[{"id":"r1","label":"React"}]') returning id as open_job \gset
insert into public.jobs (org_id, code, title, department, location, employment_type, owner, status)
values (:'acme', 'JOB-DRAFT', 'Secret Draft Role', 'Finance', 'Abuja', 'Full-time', 'Ada', 'Draft') returning id as draft_job \gset
select set_config('t.open', :'open_job', false);
select set_config('t.acme', :'acme', false);
select set_config('t.draft', :'draft_job', false);
select pg_temp.as_anon();
do $$ begin
  if public.careers_page('acme') is not null then raise exception 'FAIL: page visible before it was turned on'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.organizations set careers_enabled = true, careers_slug = 'acme';
select pg_temp.as_anon();
do $$ begin
  if public.careers_page('acme') is not null then raise exception 'FAIL: a manager turned the careers page on'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.organizations set careers_enabled = true, careers_slug = 'acme', careers_intro = 'Join us' where id = :'acme';
do $$ begin
  begin
    update public.organizations set careers_slug = 'Bad Slug!' where id = current_setting('t.acme', true)::uuid;
    raise exception 'FAIL: bad slug accepted';
  exception when check_violation then null;
  end;
end $$;

\echo 'TEST visitors see open jobs only, with no internal fields'
select pg_temp.as_anon();
do $$ declare p jsonb; t text; begin
  p := public.careers_page('ACME');
  if p ->> 'company' <> 'Acme Ltd' then raise exception 'FAIL: company name %', p ->> 'company'; end if;
  if p::text like '%Secret Draft Role%' then raise exception 'FAIL: draft job exposed'; end if;
  if jsonb_array_length(p -> 'jobs') < 1 then raise exception 'FAIL: open job missing'; end if;
  if p::text like '%owner%' or p::text like '%channels%' or p::text like '%org_id%' then raise exception 'FAIL: internal fields exposed'; end if;
  if (p -> 'jobs' -> 0 -> 'requirements') ->> 0 is null then raise exception 'FAIL: requirements missing'; end if;
end $$;

\echo 'TEST visitors cannot read or write any table directly'
do $$ declare n int; begin
  select count(*) into n from public.candidates;
  if n <> 0 then raise exception 'FAIL: anon reads candidates'; end if;
  select count(*) into n from public.jobs;
  if n <> 0 then raise exception 'FAIL: anon reads jobs'; end if;
  begin
    insert into public.candidates (org_id, name, email) values (gen_random_uuid(), 'Sneaky', 'x@y.co');
    raise exception 'FAIL: anon inserted a candidate';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'TEST applications are validated, need consent, land in the pipeline once, and are rate-limited'
do $$ declare r text; n int; begin
  r := public.submit_application('acme', current_setting('t.draft')::uuid, 'Ann Applicant', 'ann@example.com', '', 'Lagos', 3, '', true);
  if r <> 'closed' then raise exception 'FAIL: applied to a draft job (%)', r; end if;
  r := public.submit_application('acme', current_setting('t.open')::uuid, 'Ann Applicant', 'ann@example.com', '', 'Lagos', 3, '', false);
  if r <> 'consent' then raise exception 'FAIL: no consent accepted (%)', r; end if;
  r := public.submit_application('acme', current_setting('t.open')::uuid, 'A', 'not-an-email', '', '', 3, '', true);
  if r <> 'invalid' then raise exception 'FAIL: invalid accepted (%)', r; end if;
  r := public.submit_application('acme', current_setting('t.open')::uuid, ' Ann Applicant ', 'Ann@Example.com', '+234 800 000 0001', 'Lagos', 3, 'I love building.', true);
  if r <> 'ok' then raise exception 'FAIL: good application rejected (%)', r; end if;
  r := public.submit_application('acme', current_setting('t.open')::uuid, 'Ann Again', 'ann@example.com', '', '', 0, '', true);
  if r <> 'duplicate' then raise exception 'FAIL: duplicate accepted (%)', r; end if;
  r := public.submit_application('nope', current_setting('t.open')::uuid, 'Ann', 'ann@example.com', '', '', 0, '', true);
  if r <> 'closed' then raise exception 'FAIL: wrong company accepted (%)', r; end if;
end $$;
reset role;
do $$ declare c record; n int; begin
  select * into c from public.candidates where email = 'ann@example.com';
  if c.source <> 'Careers page' or c.stage <> 'Applied' or c.cv_status <> 'Missing' or c.name <> 'Ann Applicant' or (c.profile ->> 'consentAt') is null then
    raise exception 'FAIL: candidate stored wrongly (%)', row_to_json(c);
  end if;
  select count(*) into n from public.candidate_notes where candidate_id = c.id and text like 'From the applicant:%';
  if n <> 1 then raise exception 'FAIL: applicant note missing'; end if;
  select count(*) into n from public.activity where title = 'New application from careers page';
  if n <> 1 then raise exception 'FAIL: activity missing'; end if;
end $$;
select pg_temp.as_anon();
do $$ declare r text; i int; begin
  for i in 1..40 loop
    r := public.submit_application('acme', current_setting('t.open')::uuid, 'Bot ' || i, 'bot' || i || '@example.com', '', '', 0, '', true);
  end loop;
  if r <> 'busy' then raise exception 'FAIL: flood not limited (%)', r; end if;
end $$;

\echo 'TEST other company RPCs stay closed to visitors'
do $$ begin
  begin
    perform public.create_organization('Evil', 'Eve');
    raise exception 'FAIL: anon created an organisation';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo 'ALL CAREERS TESTS PASSED'
