-- Keep employee reflections separate from manager ratings and comments.
alter table public.reviews
  add column if not exists self_appraisal text not null default '',
  add column if not exists self_submitted_at timestamptz;

alter table public.reviews
  drop constraint if exists reviews_self_appraisal_length_check;
alter table public.reviews
  add constraint reviews_self_appraisal_length_check
  check (char_length(self_appraisal) <= 3000);

-- Employees submit only their own appraisal, only after HR or a manager opens
-- the self-review stage. The security-definer function updates only appraisal
-- fields and advances the cycle to manager review.
create or replace function public.submit_self_appraisal(
  p_employee_id uuid,
  p_cycle text,
  p_appraisal text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_appraisal is null or char_length(trim(p_appraisal)) < 10 or char_length(trim(p_appraisal)) > 3000 then
    raise exception 'Self-appraisal must be between 10 and 3000 characters';
  end if;

  select e.id into v_employee_id
  from public.employees e
  where e.id = p_employee_id and e.user_id = auth.uid() and e.status = 'Active';
  if v_employee_id is null then
    raise exception 'You can only submit your own self-appraisal';
  end if;

  update public.reviews r
  set self_appraisal = trim(p_appraisal),
      self_submitted_at = now(),
      status = 'Manager review',
      updated_at = now()
  where r.employee_id = v_employee_id
    and r.cycle = p_cycle
    and r.status = 'Self review';
  if not found then
    raise exception 'This review is not open for self-appraisal';
  end if;
end;
$$;

revoke all on function public.submit_self_appraisal(uuid, text, text) from public;
grant execute on function public.submit_self_appraisal(uuid, text, text) to authenticated;
