-- Employee record tests. Runs after paye_test.sql (Femi is a linked employee).
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
select set_config('t.acme', :'acme', false);
select set_config('t.femi', :'femi_emp', false);
select set_config('t.chidi', :'chidi_emp', false);

\echo 'TEST HR admins keep full records and bank details; staff IDs are unique'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.employee_records (org_id, employee_id, personal, job)
values (:'acme', :'femi_emp', '{"dateOfBirth":"1995-04-02","address":"1 Allen Avenue"}', '{"staffId":"ACM-001","grade":"Associate"}'),
       (:'acme', :'chidi_emp', '{"address":"2 Herbert Macaulay Way"}', '{"staffId":"ACM-002"}');
insert into public.employee_bank (org_id, employee_id, data) values (:'acme', :'femi_emp', '{"accountNumber":"0123456789","rsaPin":"PEN100000000001"}');
do $$ begin
  begin
    update public.employee_records set job = '{"staffId":"acm-001"}' where employee_id = current_setting('t.chidi')::uuid;
    raise exception 'FAIL: duplicate staff ID accepted';
  exception when unique_violation then null;
  end;
end $$;

\echo 'TEST people see and edit their own personal details, but not their job details or bank'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare n int; v text; begin
  select count(*) into n from public.employee_records;
  if n <> 1 then raise exception 'FAIL: employee sees % records', n; end if;
  update public.employee_records set personal = personal || '{"address":"9 New Street"}' where employee_id = current_setting('t.femi')::uuid;
  select personal ->> 'address' into v from public.employee_records where employee_id = current_setting('t.femi')::uuid;
  if v <> '9 New Street' then raise exception 'FAIL: employee could not update own address'; end if;
  begin
    update public.employee_records set job = '{"staffId":"ACM-001","grade":"Director"}' where employee_id = current_setting('t.femi')::uuid;
    raise exception 'FAIL: employee promoted themselves';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.employee_bank;
  if n <> 1 then raise exception 'FAIL: employee cannot read own bank details'; end if;
  update public.employee_bank set data = '{}' where employee_id = current_setting('t.femi')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: employee changed bank details'; end if;
  update public.employee_records set personal = '{}' where employee_id = current_setting('t.chidi')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: employee changed someone else''s record'; end if;
end $$;

\echo 'TEST managers, recruiters and other companies cannot see personal or bank records'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare n int; begin
  select count(*) into n from public.employee_records where employee_id = current_setting('t.femi')::uuid;
  if n <> 0 then raise exception 'FAIL: manager/recruiter sees personal record'; end if;
  select count(*) into n from public.employee_bank;
  if n <> 0 then raise exception 'FAIL: manager/recruiter sees bank details'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ declare n int; begin
  select count(*) into n from public.employee_records;
  if n <> 0 then raise exception 'FAIL: other company sees records'; end if;
end $$;

\echo 'TEST the audit log records which fields changed, never the values'
reset role;
do $$ declare c jsonb; begin
  select changes into c from public.audit_log where table_name = 'employee_records' and action = 'update' order by id desc limit 1;
  if c::text like '%New Street%' then raise exception 'FAIL: personal values copied into audit log'; end if;
  if not (c -> 'fields') ? 'personal.address' then raise exception 'FAIL: changed field not recorded (%)', c; end if;
  select changes into c from public.audit_log where table_name = 'employee_bank' order by id desc limit 1;
  if c::text like '%0123456789%' then raise exception 'FAIL: bank values copied into audit log'; end if;
end $$;
\echo 'ALL RECORDS TESTS PASSED'
