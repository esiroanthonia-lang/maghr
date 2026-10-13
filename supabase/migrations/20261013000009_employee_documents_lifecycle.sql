-- HR-only employee documents. Files live in a private bucket and metadata is
-- scoped to the same organisation as the employee record.
alter table public.employees
  add column if not exists exit_reason text not null default ''
    check (exit_reason in ('','Resignation','Termination','Contract ended','Retirement','Other')),
  add column if not exists exit_checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exit_checklist) = 'array' and jsonb_array_length(exit_checklist) <= 6);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  3145728,
  array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  object_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 180),
  category text not null check (category in ('Contract','Offer letter','ID','Certificate','Other')),
  content_type text not null,
  file_size bigint not null check (file_size between 1 and 3145728),
  uploaded_by uuid not null default auth.uid(),
  uploaded_at timestamptz not null default now(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade
);

alter table public.employee_documents enable row level security;
create policy employee_documents_hr_only on public.employee_documents
  for all to authenticated
  using (public.has_role(org_id, array['hr_admin']))
  with check (public.has_role(org_id, array['hr_admin']));

create policy employee_documents_storage_hr_select on storage.objects
  for select to authenticated
  using (bucket_id = 'employee-documents'
    and public.has_role(case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[1])::uuid else null end, array['hr_admin']));
create policy employee_documents_storage_hr_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'employee-documents'
    and public.has_role(case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[1])::uuid else null end, array['hr_admin']));
create policy employee_documents_storage_hr_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'employee-documents'
    and public.has_role(case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[1])::uuid else null end, array['hr_admin']));
