-- HR change-request workflow and leave request deletion permissions.

create table if not exists public.employee_record_change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  target_table text not null check (target_table in ('employee_documents', 'performance_records')),
  target_id uuid not null,
  request_type text not null check (request_type in ('delete', 'replace', 'update')),
  details text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed', 'canceled')),
  requested_by uuid not null references public.users(id) on delete cascade,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_record_change_requests_workspace_idx
  on public.employee_record_change_requests (workspace_id, status, created_at desc);
create index if not exists employee_record_change_requests_employee_idx
  on public.employee_record_change_requests (employee_profile_id, created_at desc);
create index if not exists employee_record_change_requests_target_idx
  on public.employee_record_change_requests (target_table, target_id);

alter table public.employee_record_change_requests enable row level security;

drop policy if exists "Employees read own HR change requests" on public.employee_record_change_requests;
create policy "Employees read own HR change requests"
on public.employee_record_change_requests for select
using (
  public.can_manage_hr(workspace_id)
  or exists (
    select 1 from public.employee_profiles ep
    where ep.id = employee_profile_id
      and ep.user_id = auth.uid()
      and public.is_workforce_member(workspace_id)
  )
);

drop policy if exists "Employees create own HR change requests" on public.employee_record_change_requests;
create policy "Employees create own HR change requests"
on public.employee_record_change_requests for insert
with check (
  status = 'pending'
  and requested_by = auth.uid()
  and exists (
    select 1 from public.employee_profiles ep
    where ep.id = employee_profile_id
      and ep.user_id = auth.uid()
      and public.is_workforce_member(workspace_id)
  )
  and (
    (target_table = 'employee_documents' and exists (
      select 1 from public.employee_documents d
      where d.id = target_id
        and d.workspace_id = employee_record_change_requests.workspace_id
        and d.employee_profile_id = employee_record_change_requests.employee_profile_id
    ))
    or
    (target_table = 'performance_records' and exists (
      select 1 from public.performance_records pr
      where pr.id = target_id
        and pr.workspace_id = employee_record_change_requests.workspace_id
        and pr.employee_profile_id = employee_record_change_requests.employee_profile_id
    ))
  )
);

drop policy if exists "Authorized users review HR change requests" on public.employee_record_change_requests;
create policy "Authorized users review HR change requests"
on public.employee_record_change_requests for update
using (public.can_manage_hr(workspace_id))
with check (public.can_manage_hr(workspace_id));

drop policy if exists "Authorized users delete HR change requests" on public.employee_record_change_requests;
create policy "Authorized users delete HR change requests"
on public.employee_record_change_requests for delete
using (public.can_manage_hr(workspace_id));

drop policy if exists "Authorized users delete leave requests" on public.leave_requests;
create policy "Authorized users delete leave requests"
on public.leave_requests for delete
using (
  public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
);

do $$
begin
  alter publication supabase_realtime add table public.employee_record_change_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
