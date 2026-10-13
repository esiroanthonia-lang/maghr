-- Attendance tests. Runs after onboarding_test.sql (Femi is a linked employee).
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

\echo 'TEST clocking in uses the database clock and Lagos date, not the browser''s'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
insert into public.attendance (org_id, employee_id, date, clock_in, clock_out, mode)
values (:'acme', :'femi_emp', '2000-01-01', '2000-01-01 08:00+01', '2000-01-01 17:00+01', 'Remote');
do $$ declare r record; begin
  select * into r from public.attendance;
  if r.clock_in < now() - interval '1 minute' or r.clock_out is not null or r.date <> (now() at time zone 'Africa/Lagos')::date or r.mode <> 'Remote' then
    raise exception 'FAIL: clock-in not stamped by database (%, %, %)', r.clock_in, r.clock_out, r.date;
  end if;
end $$;

\echo 'TEST people clock in only once a day and only for themselves'
do $$ begin
  begin
    insert into public.attendance (org_id, employee_id, date) values (current_setting('t.acme')::uuid, current_setting('t.femi')::uuid, current_date);
    raise exception 'FAIL: clocked in twice';
  exception when unique_violation then null;
  end;
  begin
    insert into public.attendance (org_id, employee_id, date) values (current_setting('t.acme')::uuid, current_setting('t.chidi')::uuid, current_date);
    raise exception 'FAIL: clocked someone else in';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'TEST clocking out sets the time once; people cannot edit their times'
do $$ declare n int; begin
  begin
    update public.attendance set clock_in = now() - interval '3 hours';
    raise exception 'FAIL: employee changed clock-in';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.attendance set clock_out = now() + interval '5 hours', corrected_at = now();
    raise exception 'FAIL: employee made a correction';
  exception when insufficient_privilege then null;
  end;
end $$;
-- clock_out must be after clock_in; the database clock moves on during the transaction, so wait a moment.
select pg_sleep(0.05);
update public.attendance set clock_out = '2099-01-01';
do $$ declare r record; n int; begin
  select * into r from public.attendance;
  if r.clock_out is null or r.clock_out > now() + interval '1 minute' then raise exception 'FAIL: clock-out not stamped (%)', r.clock_out; end if;
  update public.attendance set clock_out = now();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: clocked out twice'; end if;
end $$;

\echo 'TEST HR admins correct times and the correction is signed; managers can only read'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ declare n int; begin
  select count(*) into n from public.attendance;
  if n <> 1 then raise exception 'FAIL: manager sees % rows', n; end if;
  begin
    update public.attendance set clock_in = clock_in - interval '1 hour', corrected_at = now();
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: manager corrected attendance'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.attendance set clock_in = clock_in - interval '1 hour', corrected_at = '2000-01-01';
do $$ declare r record; begin
  select * into r from public.attendance;
  if r.corrected_by_name <> 'Ada Obi' or r.corrected_at < now() - interval '1 minute' then raise exception 'FAIL: correction not signed (%)', r.corrected_by_name; end if;
end $$;

\echo 'TEST other staff and other companies see no attendance'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ declare n int; begin
  select count(*) into n from public.attendance;
  if n <> 0 then raise exception 'FAIL: another employee sees % rows', n; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ declare n int; begin
  select count(*) into n from public.attendance;
  if n <> 0 then raise exception 'FAIL: other company sees % rows', n; end if;
end $$;

\echo 'TEST work start time must look like HH:MM'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.organizations set work_start = '08:30' where id = :'acme';
do $$ begin
  begin
    update public.organizations set work_start = '9am' where id = current_setting('t.acme')::uuid;
    raise exception 'FAIL: bad work start accepted';
  exception when check_violation then null;
  end;
end $$;
\echo 'ALL ATTENDANCE TESTS PASSED'
