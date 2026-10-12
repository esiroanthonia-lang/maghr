-- Security tests for the MagHR schema. Run after 00_supabase_stub.sql and the migration.
-- Every block raises an exception (and psql stops) if a rule is broken.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'ada@acme.example'),    -- HR admin, Acme
  ('00000000-0000-0000-0000-00000000000b', 'bola@acme.example'),   -- recruiter, Acme
  ('00000000-0000-0000-0000-00000000000c', 'chidi@acme.example'),  -- manager, Acme
  ('00000000-0000-0000-0000-00000000000d', 'dayo@globex.example'), -- HR admin, Globex
  ('00000000-0000-0000-0000-00000000000e', 'efe@acme.example'),    -- employee, Acme
  ('00000000-0000-0000-0000-00000000000f', 'femi@acme.example');   -- not a member

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

-- Ada creates Acme; Dayo creates Globex.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Acme Ltd', 'Ada Obi') as acme \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.create_organization('Globex Nigeria', 'Dayo Ade') as globex \gset

\echo 'TEST create_organization twice is refused'
do $$ begin
  begin
    perform public.create_organization('Second Co');
    raise exception 'FAIL: second workspace allowed';
  exception when unique_violation then null;
  end;
end $$;

-- Ada invites Bola (recruiter), Chidi (manager), Efe (employee)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.invitations (org_id, email, role) values (:'acme', 'bola@acme.example', 'recruiter') returning token as tok_b \gset
insert into public.invitations (org_id, email, role) values (:'acme', 'chidi@acme.example', 'manager') returning token as tok_c \gset
insert into public.invitations (org_id, email, role) values (:'acme', 'efe@acme.example', 'employee') returning token as tok_e \gset

\echo 'TEST invitation cannot be used by a different email'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select set_config('t.tok', :'tok_b', false);
do $$ begin
  begin
    perform public.accept_invitation(current_setting('t.tok'));
    raise exception 'FAIL: wrong email accepted invite';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.accept_invitation(:'tok_b', 'Bola Recruiter');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.accept_invitation(:'tok_c', 'Chidi Manager');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select public.accept_invitation(:'tok_e', 'Efe Employee');

\echo 'TEST invitation cannot be reused'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select set_config('t.tok', :'tok_b', false);
do $$ begin
  begin
    perform public.accept_invitation(current_setting('t.tok'));
    raise exception 'FAIL: invitation reused';
  exception when no_data_found then null;
  end;
end $$;

-- Recruiter creates a job and candidates in Acme
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.jobs (org_id, code, title, department, location, employment_type, owner, status, requirements)
values (:'acme', 'MJ-1001', 'Frontend Engineer', 'Engineering', 'Lagos', 'Full-time', 'Bola', 'Open', '[{"id":"r1","label":"React"}]')
returning id as job \gset
insert into public.candidates (org_id, job_id, name, email, stage) values (:'acme', :'job', 'Tolu Ade', 'tolu@example.com', 'Screening') returning id as cand \gset

\echo 'TEST stage history written automatically on insert (Applied, then Screening)'
do $$ declare n int; who text; begin
  select count(*), max(by_name) into n, who from public.stage_history;
  if n <> 2 then raise exception 'FAIL: expected 2 history rows, got %', n; end if;
  if who <> 'Bola Recruiter' then raise exception 'FAIL: history actor %', who; end if;
end $$;

update public.candidates set stage = 'Interview' where id = :'cand';
\echo 'TEST stage change appends history; history cannot be edited or forged'
do $$ declare n int; begin
  select count(*) into n from public.stage_history;
  if n <> 3 then raise exception 'FAIL: expected 3 history rows, got %', n; end if;
  begin
    insert into public.stage_history (org_id, candidate_id, to_stage) select org_id, id, 'Hired' from public.candidates limit 1;
    raise exception 'FAIL: forged history insert allowed';
  exception when insufficient_privilege then null;
  end;
  update public.stage_history set to_stage = 'Hired';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: history row edited'; end if;
  delete from public.stage_history;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: history row deleted'; end if;
end $$;

\echo 'TEST data validation (bad stage, rating, email)'
do $$ begin
  begin
    update public.candidates set rating = 9;
    raise exception 'FAIL: rating 9 accepted';
  exception when check_violation then null;
  end;
  begin
    update public.candidates set stage = 'Maybe';
    raise exception 'FAIL: unknown stage accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.candidates (org_id, name, email) select org_id, 'Bad Email', 'not-an-email' from public.jobs limit 1;
    raise exception 'FAIL: bad email accepted';
  exception when check_violation then null;
  end;
end $$;

\echo 'TEST convert refuses non-hired candidates'
do $$ begin
  begin
    perform public.convert_candidate_to_employee((select id from public.candidates limit 1), 'Engineering', 'Frontend Engineer', 'Lagos', current_date + 14);
    raise exception 'FAIL: converted a non-hired candidate';
  exception when invalid_parameter_value then null;
  end;
end $$;

update public.candidates set stage = 'Hired' where id = :'cand';
select public.convert_candidate_to_employee(:'cand', 'Engineering', 'Frontend Engineer', 'Lagos', current_date + 14) as emp \gset
\echo 'TEST convert works once for hired candidate, and only once'
do $$ declare e int; begin
  select count(*) into e from public.employees where source = 'Converted from candidate';
  if e <> 1 then raise exception 'FAIL: employee not created'; end if;
  begin
    perform public.convert_candidate_to_employee((select id from public.candidates limit 1), 'Engineering', 'X', 'Lagos', current_date);
    raise exception 'FAIL: converted twice';
  exception when unique_violation then null;
  end;
end $$;

\echo 'TEST recruiter cannot add employees directly or read the audit log'
do $$ declare n int; begin
  begin
    insert into public.employees (org_id, name, email, department, job_title, start_date)
    select org_id, 'Sneaky Hire', 'sneaky@example.com', 'Sales', 'Rep', current_date from public.jobs limit 1;
    raise exception 'FAIL: recruiter inserted employee';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.audit_log;
  if n <> 0 then raise exception 'FAIL: recruiter can read audit log'; end if;
end $$;

\echo 'TEST manager can read candidates and add notes but cannot change them'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.candidate_notes (org_id, candidate_id, text, author_name) values (:'acme', :'cand', 'Strong portfolio', 'Chidi');
do $$ declare n int; begin
  select count(*) into n from public.candidates;
  if n <> 1 then raise exception 'FAIL: manager sees % candidates', n; end if;
  update public.candidates set rating = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: manager changed a candidate'; end if;
  begin
    insert into public.jobs (org_id, code, title, department, location, employment_type, owner)
    select org_id, 'MJ-9', 'Rogue job', 'Sales', 'Lagos', 'Full-time', 'Chidi' from public.candidates limit 1;
    raise exception 'FAIL: manager created a job';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'TEST employee sees no recruitment data and only their own employee record'
select pg_temp.as_admin();
update public.employees set user_id = '00000000-0000-0000-0000-00000000000e' where id = :'emp';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ declare n int; begin
  select count(*) into n from public.candidates;
  if n <> 0 then raise exception 'FAIL: employee sees candidates'; end if;
  select count(*) into n from public.jobs;
  if n <> 0 then raise exception 'FAIL: employee sees jobs'; end if;
  select count(*) into n from public.employees;
  if n <> 1 then raise exception 'FAIL: employee sees % employee rows', n; end if;
end $$;

\echo 'TEST another company sees nothing from Acme and cannot write into it'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select set_config('t.acme', :'acme', false);
select set_config('t.job', :'job', false);
do $$ declare n int; begin
  select count(*) into n from public.jobs;          if n <> 0 then raise exception 'FAIL: Globex sees Acme jobs'; end if;
  select count(*) into n from public.candidates;    if n <> 0 then raise exception 'FAIL: Globex sees Acme candidates'; end if;
  select count(*) into n from public.employees;     if n <> 0 then raise exception 'FAIL: Globex sees Acme employees'; end if;
  select count(*) into n from public.memberships where org_id = current_setting('t.acme')::uuid;
  if n <> 0 then raise exception 'FAIL: Globex sees Acme team'; end if;
  select count(*) into n from public.audit_log;     if n <> 0 then raise exception 'FAIL: Globex sees Acme audit'; end if;
  begin
    insert into public.candidates (org_id, name, email) values (current_setting('t.acme')::uuid, 'Planted', 'p@example.com');
    raise exception 'FAIL: Globex wrote into Acme';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'TEST a candidate cannot be linked to another company''s job'
do $$ declare g uuid; begin
  select id into g from public.organizations limit 1; -- Globex (only one visible)
  begin
    insert into public.candidates (org_id, job_id, name, email) values (g, current_setting('t.job')::uuid, 'Cross Link', 'x@example.com');
    raise exception 'FAIL: cross-company job link allowed';
  exception when foreign_key_violation then null;
  end;
end $$;

\echo 'TEST non-members and anonymous visitors see nothing'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare n int; begin
  select count(*) into n from public.organizations; if n <> 0 then raise exception 'FAIL: outsider sees orgs'; end if;
  select count(*) into n from public.candidates;    if n <> 0 then raise exception 'FAIL: outsider sees candidates'; end if;
end $$;
select pg_temp.as_admin();
set role anon;
do $$ declare n int; begin
  select count(*) into n from public.candidates; if n <> 0 then raise exception 'FAIL: anon sees candidates'; end if;
  begin
    perform public.create_organization('Anon Co');
    raise exception 'FAIL: anon created org';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'TEST HR admin cannot demote themselves (avoids locking the company out); can manage others; reads audit'
select pg_temp.as_admin();
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare n int; begin
  begin
    update public.memberships set role = 'employee' where user_id = auth.uid();
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.memberships where user_id = auth.uid() and role = 'hr_admin';
  if n <> 1 then raise exception 'FAIL: admin demoted self'; end if;
  update public.memberships set role = 'manager' where email = 'bola@acme.example';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not change a role'; end if;
  select count(*) into n from public.audit_log where table_name = 'candidates' and action = 'update';
  if n < 3 then raise exception 'FAIL: audit log incomplete (%)', n; end if;
end $$;

\echo 'TEST a user cannot raise their own role'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ declare r text; begin
  begin
    update public.memberships set role = 'hr_admin' where user_id = auth.uid();
  exception when insufficient_privilege then null;
  end;
  select role into r from public.memberships where user_id = auth.uid();
  if r <> 'manager' then raise exception 'FAIL: self-promotion to %', r; end if;
end $$;

\echo 'ALL SECURITY TESTS PASSED'
