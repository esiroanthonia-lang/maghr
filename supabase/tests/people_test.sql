-- Security tests for the people modules. Runs after rls_test.sql (reuses its users and companies).
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

-- Second HR admin for Acme (needed for payroll approval)
select pg_temp.as_admin();
insert into auth.users values ('00000000-0000-0000-0000-0000000000a2', 'amaka@acme.example');
insert into public.memberships (org_id, user_id, role, full_name, email)
select org_id, '00000000-0000-0000-0000-0000000000a2', 'hr_admin', 'Amaka Second', 'amaka@acme.example'
from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a';
select org_id as acme from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a' \gset
select id as efe_emp from public.employees where user_id = '00000000-0000-0000-0000-00000000000e' \gset

-- Ada (HR admin) adds an employee with pay
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.employees (org_id, name, email, department, job_title, start_date, status, manager_name, employment_type)
values (:'acme', 'Ngozi Admin Test', 'ngozi@example.com', 'Finance', 'Accountant', current_date, 'Active', 'Ada Obi', 'Full-time') returning id as ngozi \gset
insert into public.employee_compensation (org_id, employee_id, monthly_gross) values (:'acme', :'ngozi', 450000);
insert into public.employee_compensation (org_id, employee_id, monthly_gross) values (:'acme', :'efe_emp', 300000);

\echo 'TEST pay is visible to HR admins only'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); -- now a manager (demoted in rls_test)
do $$ declare n int; begin
  select count(*) into n from public.employee_compensation;
  if n <> 0 then raise exception 'FAIL: manager sees pay'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ declare n int; begin
  select count(*) into n from public.employee_compensation;
  if n <> 0 then raise exception 'FAIL: employee sees pay table'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ declare n int; begin
  select count(*) into n from public.employee_compensation;
  if n <> 0 then raise exception 'FAIL: other company sees pay'; end if;
end $$;

\echo 'TEST employee requests own leave; cannot request for others or approve'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
insert into public.leave_requests (org_id, employee_id, leave_type, start_date, end_date, days)
values (:'acme', :'efe_emp', 'Annual', current_date + 7, current_date + 9, 3) returning id as efe_leave \gset
select set_config('t.ngozi', :'ngozi', false);
select set_config('t.acme', :'acme', false);
select set_config('t.leave', :'efe_leave', false);
do $$ declare n int; begin
  begin
    insert into public.leave_requests (org_id, employee_id, leave_type, start_date, end_date, days)
    values (current_setting('t.acme')::uuid, current_setting('t.ngozi')::uuid, 'Annual', current_date, current_date, 1);
    raise exception 'FAIL: employee requested leave for someone else';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.leave_requests set status = 'Approved' where id = current_setting('t.leave')::uuid;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: employee approved own leave'; end if;
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.leave_requests;
  if n <> 1 then raise exception 'FAIL: employee sees % leave rows', n; end if;
end $$;

\echo 'TEST manager approves leave and the decision is stamped'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.leave_requests set status = 'Approved' where id = :'efe_leave';
do $$ declare who text; begin
  select decided_by_name into who from public.leave_requests where id = current_setting('t.leave')::uuid;
  if who <> 'Chidi Manager' then raise exception 'FAIL: decision not stamped (%)', who; end if;
end $$;

\echo 'TEST leave dates must make sense'
do $$ begin
  begin
    insert into public.leave_requests (org_id, employee_id, leave_type, start_date, end_date, days)
    values (current_setting('t.acme')::uuid, current_setting('t.ngozi')::uuid, 'Annual', current_date + 5, current_date, 1);
    raise exception 'FAIL: end before start accepted';
  exception when check_violation then null;
  end;
end $$;

\echo 'TEST payroll: preparer cannot approve own run; a second HR admin can; approved runs are locked'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.payroll_runs (org_id, period, employee_count, gross_total) values (:'acme', '2026-10', 2, 750000) returning id as run \gset
select set_config('t.run', :'run', false);
do $$ declare s text; begin
  begin
    update public.payroll_runs set status = 'Approved' where id = current_setting('t.run')::uuid;
    raise exception 'FAIL: approved straight from draft';
  exception when invalid_parameter_value then null;
  end;
  update public.payroll_runs set status = 'Pending approval' where id = current_setting('t.run')::uuid;
  begin
    update public.payroll_runs set status = 'Approved' where id = current_setting('t.run')::uuid;
    raise exception 'FAIL: preparer approved own run';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.payroll_runs set gross_total = 1 where id = current_setting('t.run')::uuid;
    raise exception 'FAIL: totals changed while pending';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
update public.payroll_runs set status = 'Approved' where id = :'run';
do $$ declare who text; begin
  select approved_by_name into who from public.payroll_runs where id = current_setting('t.run')::uuid;
  if who <> 'Amaka Second' then raise exception 'FAIL: approver not recorded (%)', who; end if;
  begin
    update public.payroll_runs set status = 'Draft' where id = current_setting('t.run')::uuid;
    raise exception 'FAIL: approved run reopened';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ declare n int; begin
  select count(*) into n from public.payroll_runs;
  if n <> 0 then raise exception 'FAIL: manager sees payroll'; end if;
end $$;

\echo 'TEST goals readable by all members, editable by HR/managers only'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.goals (org_id, title, owner_name, department, due_date, progress) values (:'acme', 'Cut time to hire', 'People team', 'People Operations', current_date + 30, 20);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ declare n int; begin
  select count(*) into n from public.goals;
  if n <> 1 then raise exception 'FAIL: employee cannot read goals'; end if;
  update public.goals set progress = 100;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: employee edited a goal'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ declare n int; begin
  select count(*) into n from public.goals;
  if n <> 0 then raise exception 'FAIL: other company sees goals'; end if;
end $$;

\echo 'ALL PEOPLE TESTS PASSED'
