-- PAYE / payslip tests. Runs after careers_test.sql (Femi is a linked employee, Ada and Bola-as-manager exist).
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
-- A second HR admin to approve (a2 was created as hr_admin by earlier tests).
select user_id as second_admin from public.memberships where org_id = :'acme' and role = 'hr_admin' and user_id <> '00000000-0000-0000-0000-00000000000a' limit 1 \gset
select set_config('t.acme', :'acme', false);
select set_config('t.femi', :'femi_emp', false);
select set_config('t.chidi', :'chidi_emp', false);

\echo 'TEST HR admins store payroll rules and rent; staff cannot change them'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.organizations set payroll_config = '{"pensionEmployeeRate": 8}' where id = :'acme';
update public.employee_compensation set annual_rent = 1200000 where employee_id = :'femi_emp';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare n int; v numeric; begin
  update public.organizations set payroll_config = '{}' where id = current_setting('t.acme')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: employee changed payroll rules'; end if;
  update public.employee_compensation set annual_rent = 99 where employee_id = current_setting('t.femi')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: employee changed own rent'; end if;
  select annual_rent into v from public.employee_compensation where employee_id = current_setting('t.femi')::uuid;
  if v <> 1200000 then raise exception 'FAIL: employee cannot read own rent (%)', v; end if;
end $$;

\echo 'TEST payslips are added while Draft, must add up, and lock when submitted'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.payroll_runs (org_id, period) values (:'acme', '2026-12') returning id as run \gset
select set_config('t.run', :'run', false);
insert into public.payroll_lines (org_id, run_id, employee_id, employee_name, gross, basic, housing, transport, other, pension, nhf, paye, net)
values (:'acme', :'run', :'femi_emp', 'Femi Later', 250000, 100000, 75000, 37500, 37500, 17000, 2500, 20000, 210500),
       (:'acme', :'run', :'chidi_emp', 'Chidi Manager', 400000, 160000, 120000, 60000, 60000, 27200, 4000, 40000, 328800);
do $$ begin
  begin
    insert into public.payroll_lines (org_id, run_id, employee_id, gross, net) values (current_setting('t.acme')::uuid, current_setting('t.run')::uuid, gen_random_uuid(), 100, 1);
    raise exception 'FAIL: line that does not add up accepted';
  exception when check_violation or foreign_key_violation then null;
  end;
end $$;
update public.payroll_runs set gross_total = 650000, employee_count = 2, paye_total = 60000, pension_total = 44200, nhf_total = 6500, net_total = 539300, employer_pension_total = 55250 where id = :'run';
update public.payroll_runs set status = 'Pending approval' where id = :'run';
do $$ begin
  begin
    update public.payroll_lines set paye = 0, net = net + 20000 where employee_id = current_setting('t.femi')::uuid;
    raise exception 'FAIL: submitted payslip changed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.payroll_runs set paye_total = 1 where id = current_setting('t.run')::uuid;
    raise exception 'FAIL: submitted PAYE total changed';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'TEST staff see only their own payslip, and only after approval'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare n int; begin
  select count(*) into n from public.payroll_lines;
  if n <> 0 then raise exception 'FAIL: payslip visible before approval'; end if;
end $$;
select pg_temp.as_user(:'second_admin');
update public.payroll_runs set status = 'Approved' where id = :'run';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare n int; v numeric; begin
  select count(*), max(net) into n, v from public.payroll_lines;
  if n <> 1 or v <> 210500 then raise exception 'FAIL: employee sees % payslips (net %)', n, v; end if;
end $$;
\echo 'TEST staff can find the period of their own approved payslip, and nothing else'
do $$ declare n int; begin
  select count(*) into n from public.my_payslip_runs();
  if n <> 1 then raise exception 'FAIL: employee should see 1 approved run, saw %', n; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ declare n int; begin
  select count(*) into n from public.my_payslip_runs();
  if n <> 0 then raise exception 'FAIL: manager without a payslip sees % runs', n; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ declare n int; begin
  select count(*) into n from public.payroll_lines where employee_id <> current_setting('t.chidi')::uuid;
  if n <> 0 then raise exception 'FAIL: manager sees other people''s payslips'; end if;
end $$;

\echo 'TEST approved runs and their payslips cannot be changed or deleted'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    delete from public.payroll_runs where id = current_setting('t.run')::uuid;
    raise exception 'FAIL: approved run deleted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.payroll_lines where run_id = current_setting('t.run')::uuid;
    raise exception 'FAIL: approved payslips deleted';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo 'ALL PAYE TESTS PASSED'
