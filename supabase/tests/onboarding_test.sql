-- Onboarding checklist tests. Runs after self_service_test.sql (Femi is a linked employee).
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, false);
  execute 'set role authenticated';
end $$;
reset role;
select org_id as acme from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a' \gset
select id as femi_emp from public.employees where email = 'femi@acme.example' \gset
select id as chidi_emp from public.employees where lower(email) = 'chidi@acme.example' \gset

\echo 'TEST HR creates a checklist; the database stamps who ticked a step, not the browser'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.onboarding_tasks (org_id, employee_id, title, owner, position) values
  (:'acme', :'femi_emp', 'Receive signed contract', 'HR', 0),
  (:'acme', :'femi_emp', 'Read the employee handbook', 'New hire', 1),
  (:'acme', :'chidi_emp', 'Set up laptop', 'Manager', 0);
update public.onboarding_tasks set done_at = '2000-01-01', done_by_name = 'Someone else' where title = 'Receive signed contract';
do $$ declare r record; begin
  select done_at, done_by_name into r from public.onboarding_tasks where title = 'Receive signed contract';
  if r.done_at < now() - interval '1 minute' or r.done_by_name <> 'Ada Obi' then raise exception 'FAIL: tick not stamped by database (%, %)', r.done_at, r.done_by_name; end if;
end $$;

select set_config('t.acme', :'acme', false);
select set_config('t.femi', :'femi_emp', false);
\echo 'TEST a new hire sees only their own checklist and ticks only their own steps'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare n int; begin
  select count(*) into n from public.onboarding_tasks;
  if n <> 2 then raise exception 'FAIL: new hire sees % steps (expected own 2)', n; end if;
  update public.onboarding_tasks set done_at = now() where title = 'Read the employee handbook';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: new hire could not tick own step'; end if;
  update public.onboarding_tasks set done_at = null where title = 'Receive signed contract';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: new hire unticked an HR step'; end if;
  begin
    update public.onboarding_tasks set title = 'Renamed' where title = 'Read the employee handbook';
    raise exception 'FAIL: new hire renamed a step';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.onboarding_tasks set owner = 'New hire' where title = 'Receive signed contract';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: new hire took over an HR step'; end if;
  end;
  begin
    insert into public.onboarding_tasks (org_id, employee_id, title, owner) values (current_setting('t.acme')::uuid, current_setting('t.femi')::uuid, 'Sneaky', 'New hire');
    raise exception 'FAIL: new hire added a step';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'TEST other staff and other companies see no checklists; managers see all'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ declare n int; begin
  select count(*) into n from public.onboarding_tasks;
  if n <> 0 then raise exception 'FAIL: another employee sees % steps', n; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ declare n int; begin
  select count(*) into n from public.onboarding_tasks;
  if n <> 0 then raise exception 'FAIL: other company sees % steps', n; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ declare n int; begin
  select count(*) into n from public.onboarding_tasks;
  if n <> 3 then raise exception 'FAIL: manager sees % steps', n; end if;
end $$;
\echo 'ALL ONBOARDING TESTS PASSED'
