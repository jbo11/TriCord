create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  work_date date not null,
  hours numeric(8,2) not null check (hours > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists overtime_requests_workspace_idx on public.overtime_requests(workspace_id, created_at desc);
create index if not exists overtime_requests_employee_idx on public.overtime_requests(employee_profile_id, work_date desc);

alter table public.overtime_requests enable row level security;

drop policy if exists "Hub members read overtime requests" on public.overtime_requests;
create policy "Hub members read overtime requests" on public.overtime_requests
for select using (
  exists (
    select 1 from public.memberships wm
    where wm.workspace_id = overtime_requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Employees create own overtime requests" on public.overtime_requests;
create policy "Employees create own overtime requests" on public.overtime_requests
for insert with check (
  exists (
    select 1 from public.employee_profiles ep
    where ep.id = overtime_requests.employee_profile_id
      and ep.workspace_id = overtime_requests.workspace_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists "Employees update own pending overtime requests" on public.overtime_requests;
create policy "Employees update own pending overtime requests" on public.overtime_requests
for update using (
  status = 'pending'
  and exists (
    select 1 from public.employee_profiles ep
    where ep.id = overtime_requests.employee_profile_id
      and ep.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.employee_profiles ep
    where ep.id = overtime_requests.employee_profile_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists "Owners and approved admins manage overtime requests" on public.overtime_requests;
create policy "Owners and approved admins manage overtime requests" on public.overtime_requests
for all using (
  public.has_workspace_role(overtime_requests.workspace_id, array['owner']::public.workspace_role[])
  or public.has_workspace_capability(overtime_requests.workspace_id, 'approve_leave')
) with check (
  public.has_workspace_role(overtime_requests.workspace_id, array['owner']::public.workspace_role[])
  or public.has_workspace_capability(overtime_requests.workspace_id, 'approve_leave')
);

do $$
begin
  alter publication supabase_realtime add table public.overtime_requests;
exception when duplicate_object then null;
end $$;
