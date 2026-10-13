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

\echo 'TEST HR admins add company holidays; everyone in the company can read them; nobody else can'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.company_holidays (org_id, date, name) values (:'acme', '2026-03-20', 'Eid-el-Fitr');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select set_config('t.acme', :'acme', false);
do $$ declare n int; begin
  select count(*) into n from public.company_holidays;
  if n <> 1 then raise exception 'FAIL: employee cannot read holidays'; end if;
  begin
    insert into public.company_holidays (org_id, date, name) values (current_setting('t.acme')::uuid, '2026-05-27', 'Sneaky');
    raise exception 'FAIL: employee added a holiday';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ declare n int; begin
  select count(*) into n from public.company_holidays;
  if n <> 0 then raise exception 'FAIL: other company sees holidays'; end if;
end $$;
\echo 'ALL HOLIDAY TESTS PASSED'
