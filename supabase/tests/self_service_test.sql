-- Self-service tests. Runs after people_test.sql.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

select pg_temp.as_admin();
select org_id as acme from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a' \gset

\echo 'TEST a new employee record is linked to the matching member automatically'
-- Chidi (manager, chidi@acme.example) has no employee record yet; HR adds one.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.employees (org_id, name, email, department, job_title, start_date, status)
values (:'acme', 'Chidi Manager', 'CHIDI@acme.example', 'Engineering', 'Engineering Manager', current_date, 'Active') returning id as chidi_emp \gset
select pg_temp.as_admin();
do $$ declare u uuid; begin
  select user_id into u from public.employees where lower(email) = 'chidi@acme.example';
  if u is distinct from '00000000-0000-0000-0000-00000000000c'::uuid then raise exception 'FAIL: not linked (%)', u; end if;
end $$;

\echo 'TEST a member who joins later is linked to their existing employee record'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.employees (org_id, name, email, department, job_title, start_date, status)
values (:'acme', 'Femi Later', 'femi@acme.example', 'Sales', 'Rep', current_date, 'Onboarding') returning id as femi_emp \gset
insert into public.invitations (org_id, email, role) values (:'acme', 'femi@acme.example', 'employee') returning token as tok_f \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select public.accept_invitation(:'tok_f', 'Femi Later');
do $$ declare n int; begin
  select count(*) into n from public.employees;
  if n <> 1 then raise exception 'FAIL: new member sees % employee rows (expected own only)', n; end if;
end $$;

\echo 'TEST employees see their own pay but nobody else''s'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.employee_compensation (org_id, employee_id, monthly_gross) values (:'acme', :'femi_emp', 250000);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare n int; v numeric; begin
  select count(*), max(monthly_gross) into n, v from public.employee_compensation;
  if n <> 1 or v <> 250000 then raise exception 'FAIL: employee pay visibility (% rows, %)', n, v; end if;
  begin
    update public.employee_compensation set monthly_gross = 999999;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: employee changed own pay'; end if;
  end;
end $$;

\echo 'TEST employee requests and cancels own leave, but cannot approve it'
select set_config('t.acme', :'acme', false);
select set_config('t.femi', :'femi_emp', false);
do $$ declare lid uuid; n int; begin
  insert into public.leave_requests (org_id, employee_id, leave_type, start_date, end_date, days)
  values (current_setting('t.acme')::uuid, current_setting('t.femi')::uuid, 'Annual', current_date + 10, current_date + 11, 2) returning leave_requests.id into lid;
  begin
    update public.leave_requests set status = 'Approved' where leave_requests.id = lid;
    raise exception 'FAIL: employee approved own leave';
  exception when insufficient_privilege then null;
  end;
  update public.leave_requests set status = 'Cancelled' where leave_requests.id = lid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: employee could not cancel own pending leave'; end if;
end $$;

\echo 'ALL SELF-SERVICE TESTS PASSED'
