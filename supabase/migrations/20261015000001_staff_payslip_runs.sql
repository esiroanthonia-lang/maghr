-- Staff couldn't see their payslips: they can't read payroll_runs (company totals are HR-only), so the
-- app never knew which of their payslip rows belonged to an approved run or what its period was.
-- This returns only the id and period of approved runs that contain the caller's own payslip.
create or replace function public.my_payslip_runs()
returns table (id uuid, period text)
language sql stable security definer set search_path = public as $$
  select r.id, r.period
  from public.payroll_runs r
  where r.status = 'Approved'
    and exists (
      select 1 from public.payroll_lines l
      join public.employees e on e.id = l.employee_id
      where l.run_id = r.id and e.user_id = auth.uid()
    )
$$;
revoke execute on function public.my_payslip_runs() from public, anon;
grant execute on function public.my_payslip_runs() to authenticated;
