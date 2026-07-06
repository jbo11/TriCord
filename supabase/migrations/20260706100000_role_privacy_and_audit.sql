-- Capability-based administration, private profile fields, guest isolation,
-- and append-only auditing for privileged business operations.

create table if not exists public.workspace_capabilities (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  manage_members boolean not null default false,
  manage_rooms boolean not null default false,
  manage_knowledge boolean not null default false,
  manage_hr boolean not null default false,
  approve_leave boolean not null default false,
  manage_timekeeping boolean not null default false,
  correct_attendance boolean not null default false,
  manage_payroll boolean not null default false,
  approve_payroll boolean not null default false,
  view_reports boolean not null default false,
  view_audit boolean not null default false,
  granted_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

insert into public.workspace_capabilities (
  workspace_id, user_id, manage_timekeeping, correct_attendance, granted_by, updated_at
)
select workspace_id, user_id, manage_timekeeping_settings, manage_time_entries, granted_by, updated_at
from public.workforce_permissions
on conflict (workspace_id, user_id) do update set
  manage_timekeeping = excluded.manage_timekeeping,
  correct_attendance = excluded.correct_attendance,
  granted_by = excluded.granted_by,
  updated_at = excluded.updated_at;

create or replace function public.has_workspace_capability(target_workspace_id uuid, capability text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['owner']::public.workspace_role[])
    or (
      public.has_workspace_role(target_workspace_id, array['admin']::public.workspace_role[])
      and exists (
        select 1
        from public.workspace_capabilities c
        where c.workspace_id = target_workspace_id
          and c.user_id = auth.uid()
          and case capability
            when 'manage_members' then c.manage_members
            when 'manage_rooms' then c.manage_rooms
            when 'manage_knowledge' then c.manage_knowledge
            when 'manage_hr' then c.manage_hr
            when 'approve_leave' then c.approve_leave
            when 'manage_timekeeping' then c.manage_timekeeping
            when 'correct_attendance' then c.correct_attendance
            when 'manage_payroll' then c.manage_payroll
            when 'approve_payroll' then c.approve_payroll
            when 'view_reports' then c.view_reports
            when 'view_audit' then c.view_audit
            else false
          end
      )
    );
$$;

alter table public.workspace_capabilities enable row level security;

drop policy if exists "Users read effective workspace capabilities" on public.workspace_capabilities;
create policy "Users read effective workspace capabilities"
on public.workspace_capabilities for select
using (
  user_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
);

drop policy if exists "Owners manage workspace capabilities" on public.workspace_capabilities;
create policy "Owners manage workspace capabilities"
on public.workspace_capabilities for all
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (
  public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
  and exists (
    select 1 from public.memberships m
    where m.workspace_id = workspace_capabilities.workspace_id
      and m.user_id = workspace_capabilities.user_id
      and m.role = 'admin'
  )
);

create table if not exists public.user_private_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  phone text,
  address text,
  bio text,
  updated_at timestamptz not null default now()
);

insert into public.user_private_profiles (user_id, phone, address, bio)
select id, phone, address, bio from public.users
on conflict (user_id) do update set
  phone = coalesce(public.user_private_profiles.phone, excluded.phone),
  address = coalesce(public.user_private_profiles.address, excluded.address),
  bio = coalesce(public.user_private_profiles.bio, excluded.bio);

update public.users set phone = null, address = null, bio = null
where phone is not null or address is not null or bio is not null;

alter table public.user_private_profiles enable row level security;

drop policy if exists "Users read permitted private profiles" on public.user_private_profiles;
create policy "Users read permitted private profiles"
on public.user_private_profiles for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.memberships target
    where target.user_id = user_private_profiles.user_id
      and (
        public.has_workspace_capability(target.workspace_id, 'manage_members')
        or public.has_workspace_capability(target.workspace_id, 'manage_hr')
      )
  )
);

drop policy if exists "Users create own private profile" on public.user_private_profiles;
create policy "Users create own private profile"
on public.user_private_profiles for insert
with check (user_id = auth.uid());

drop policy if exists "Users update own private profile" on public.user_private_profiles;
create policy "Users update own private profile"
on public.user_private_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- The authenticated role may only read the public columns from users.
revoke select on public.users from authenticated;
grant select (id, email, display_name, full_name, nickname, avatar_url, timezone, created_at, updated_at)
on public.users to authenticated;

create or replace function public.save_own_private_profile(
  new_phone text,
  new_address text,
  new_bio text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  insert into public.user_private_profiles (user_id, phone, address, bio, updated_at)
  values (auth.uid(), nullif(trim(new_phone), ''), nullif(trim(new_address), ''), nullif(trim(new_bio), ''), now())
  on conflict (user_id) do update set
    phone = excluded.phone,
    address = excluded.address,
    bio = excluded.bio,
    updated_at = now();
end;
$$;

-- Guests only see Rooms explicitly shared through space_memberships.
create or replace function public.can_access_space(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.spaces s
    join public.memberships m
      on m.workspace_id = s.workspace_id and m.user_id = auth.uid()
    left join public.space_memberships sm
      on sm.space_id = s.id and sm.user_id = auth.uid()
    where s.id = target_space_id
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'member' and (s.access = 'public' or sm.id is not null))
        or (m.role = 'guest' and sm.id is not null)
      )
  );
$$;

drop policy if exists "Workspace peers can read profiles" on public.users;
create policy "Workspace peers can read profiles"
on public.users for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.memberships viewer
    join public.memberships peer on peer.workspace_id = viewer.workspace_id
    where viewer.user_id = auth.uid()
      and peer.user_id = public.users.id
      and viewer.role <> 'guest'
  )
  or exists (
    select 1
    from public.posts p
    where p.author_id = public.users.id
      and public.can_access_space(p.space_id)
  )
);

drop policy if exists "Admins manage memberships" on public.memberships;
create policy "Authorized users manage memberships"
on public.memberships for all
using (public.has_workspace_capability(workspace_id, 'manage_members'))
with check (public.has_workspace_capability(workspace_id, 'manage_members'));

drop policy if exists "Admins manage spaces" on public.spaces;
drop policy if exists "Admins create spaces" on public.spaces;
drop policy if exists "Admins update spaces" on public.spaces;
create policy "Authorized users create spaces"
on public.spaces for insert
with check (
  created_by = auth.uid()
  and (
    public.has_workspace_capability(workspace_id, 'manage_rooms')
    or public.has_workspace_role(workspace_id, array['member']::public.workspace_role[])
  )
);
create policy "Authorized users update spaces"
on public.spaces for update
using (
  public.has_workspace_capability(workspace_id, 'manage_rooms')
  or (created_by = auth.uid() and public.has_workspace_role(workspace_id, array['member']::public.workspace_role[]))
)
with check (
  public.has_workspace_capability(workspace_id, 'manage_rooms')
  or (created_by = auth.uid() and public.has_workspace_role(workspace_id, array['member']::public.workspace_role[]))
);
create policy "Authorized users delete spaces"
on public.spaces for delete
using (
  public.has_workspace_capability(workspace_id, 'manage_rooms')
  or (created_by = auth.uid() and public.has_workspace_role(workspace_id, array['member']::public.workspace_role[]))
);

drop policy if exists "Admins manage space members" on public.space_memberships;
create policy "Authorized users manage space members"
on public.space_memberships for all
using (
  exists (
    select 1 from public.spaces s
    where s.id = space_id
      and (
        public.has_workspace_capability(s.workspace_id, 'manage_rooms')
        or public.has_workspace_capability(s.workspace_id, 'manage_members')
      )
  )
)
with check (
  exists (
    select 1 from public.spaces s
    where s.id = space_id
      and (
        public.has_workspace_capability(s.workspace_id, 'manage_rooms')
        or public.has_workspace_capability(s.workspace_id, 'manage_members')
      )
  )
);

drop policy if exists "Admins read workspace invitations" on public.workspace_invitations;
create policy "Authorized users read workspace invitations"
on public.workspace_invitations for select
using (public.has_workspace_capability(workspace_id, 'manage_members'));

drop policy if exists "Owners can update workspace" on public.workspaces;
create policy "Owners update workspace"
on public.workspaces for update
using (public.has_workspace_role(id, array['owner']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['owner']::public.workspace_role[]));

drop policy if exists "Admins read subscriptions" on public.subscriptions;
create policy "Owners read subscriptions"
on public.subscriptions for select
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

drop policy if exists "Admins read billing events" on public.billing_events;
create policy "Owners read billing events"
on public.billing_events for select
using (
  workspace_id is not null
  and public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
);

drop policy if exists "Members can read tasks" on public.tasks;
create policy "Users read permitted tasks"
on public.tasks for select
using (
  public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
  or assignee_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "Members create tasks" on public.tasks;
create policy "Non-guests create tasks"
on public.tasks for insert
with check (
  created_by = auth.uid()
  and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

drop policy if exists "Members read knowledge articles" on public.knowledge_articles;
create policy "Non-guests read knowledge articles"
on public.knowledge_articles for select
using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

drop policy if exists "Members create knowledge articles" on public.knowledge_articles;
create policy "Non-guests create knowledge articles"
on public.knowledge_articles for insert
with check (
  created_by = auth.uid()
  and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
);

drop policy if exists "Admins update knowledge articles" on public.knowledge_articles;
create policy "Authorized users update knowledge articles"
on public.knowledge_articles for update
using (public.has_workspace_capability(workspace_id, 'manage_knowledge'))
with check (public.has_workspace_capability(workspace_id, 'manage_knowledge'));

drop policy if exists "Admins delete knowledge articles" on public.knowledge_articles;
create policy "Authorized users delete knowledge articles"
on public.knowledge_articles for delete
using (public.has_workspace_capability(workspace_id, 'manage_knowledge'));

drop policy if exists "Members can read attachments" on public.attachments;
create policy "Users read accessible attachments"
on public.attachments for select
using (
  exists (
    select 1 from public.posts p
    where p.id = attachments.post_id and public.can_access_space(p.space_id)
  )
);

drop policy if exists "Members upload attachments" on public.attachments;
create policy "Users upload accessible attachments"
on public.attachments for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.posts p
    where p.id = attachments.post_id and public.can_access_space(p.space_id)
  )
);

drop policy if exists "Members read hub files" on storage.objects;
create policy "Users read accessible hub files"
on storage.objects for select to authenticated
using (
  bucket_id = 'workspace-files'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or exists (
      select 1
      from public.attachments a
      join public.posts p on p.id = a.post_id
      where a.object_path = name and public.can_access_space(p.space_id)
    )
  )
);

drop policy if exists "Members upload hub files" on storage.objects;
create policy "Users upload accessible hub files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'workspace-files'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id::text = (storage.foldername(name))[3]
      and public.can_access_space(p.space_id)
  )
);

drop policy if exists "Uploaders and admins delete hub files" on storage.objects;
create policy "Uploaders and authorized users delete hub files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'workspace-files'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or exists (
      select 1
      from public.attachments a
      where a.object_path = name
        and public.has_workspace_role(a.workspace_id, array['owner']::public.workspace_role[])
    )
  )
);

-- Capability-aware workforce access.
create or replace function public.can_manage_time_entries(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_capability(target_workspace_id, 'correct_attendance');
$$;

create or replace function public.can_manage_timekeeping_settings(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_capability(target_workspace_id, 'manage_timekeeping');
$$;

create or replace function public.can_manage_hr(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_capability(target_workspace_id, 'manage_hr');
$$;

create or replace function public.can_manage_payroll(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_capability(target_workspace_id, 'manage_payroll');
$$;

drop policy if exists "Admins manage employee profiles" on public.employee_profiles;
create policy "Authorized users manage employee profiles" on public.employee_profiles for all
using (public.can_manage_hr(workspace_id)) with check (public.can_manage_hr(workspace_id));

drop policy if exists "Employees read permitted profiles" on public.employee_profiles;
create policy "Employees read permitted profiles" on public.employee_profiles for select using (
  (user_id = auth.uid() and public.is_workforce_member(workspace_id))
  or public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
  or public.has_workspace_capability(workspace_id, 'manage_payroll')
  or public.has_workspace_capability(workspace_id, 'approve_payroll')
  or public.has_workspace_capability(workspace_id, 'view_reports')
);

drop policy if exists "Employees read permitted documents" on public.employee_documents;
create policy "Employees read permitted documents" on public.employee_documents for select using (
  public.can_manage_hr(workspace_id)
  or (
    public.is_workforce_member(workspace_id)
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);
drop policy if exists "Employees upload own documents" on public.employee_documents;
create policy "Employees upload own documents" on public.employee_documents for insert with check (
  uploaded_by = auth.uid()
  and (
    public.can_manage_hr(workspace_id)
    or (
      public.is_workforce_member(workspace_id)
      and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
    )
  )
);
drop policy if exists "Admins delete employee documents" on public.employee_documents;
create policy "Authorized users delete employee documents" on public.employee_documents for delete
using (public.can_manage_hr(workspace_id));

drop policy if exists "Employees read own performance" on public.performance_records;
create policy "Employees read own performance" on public.performance_records for select using (
  public.can_manage_hr(workspace_id)
  or (
    public.is_workforce_member(workspace_id)
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);
drop policy if exists "Admins manage performance" on public.performance_records;
create policy "Authorized users manage performance" on public.performance_records for all
using (public.can_manage_hr(workspace_id)) with check (public.can_manage_hr(workspace_id));

drop policy if exists "Admins manage leave types" on public.leave_types;
create policy "Authorized users manage leave types" on public.leave_types for all
using (public.can_manage_hr(workspace_id)) with check (public.can_manage_hr(workspace_id));

drop policy if exists "Employees read leave balances" on public.leave_balances;
create policy "Employees read leave balances" on public.leave_balances for select using (
  public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
  or public.has_workspace_capability(workspace_id, 'view_reports')
  or (
    public.is_workforce_member(workspace_id)
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);
drop policy if exists "Admins manage leave balances" on public.leave_balances;
create policy "Authorized users manage leave balances" on public.leave_balances for all
using (public.can_manage_hr(workspace_id)) with check (public.can_manage_hr(workspace_id));

drop policy if exists "Employees read leave requests" on public.leave_requests;
create policy "Employees read leave requests" on public.leave_requests for select using (
  public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
  or public.has_workspace_capability(workspace_id, 'view_reports')
  or (
    public.is_workforce_member(workspace_id)
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);
drop policy if exists "Employees create leave requests" on public.leave_requests;
create policy "Employees create own leave requests" on public.leave_requests for insert with check (
  status = 'pending'
  and public.has_workspace_role(workspace_id, array['admin', 'member']::public.workspace_role[])
  and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
);
drop policy if exists "Admins manage leave requests" on public.leave_requests;
create policy "Authorized users approve leave requests" on public.leave_requests for update
using (
  public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
)
with check (
  public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
);

drop policy if exists "Employees read time entries" on public.time_entries;
create policy "Employees read time entries" on public.time_entries for select using (
  public.can_manage_timekeeping_settings(workspace_id)
  or public.can_manage_time_entries(workspace_id)
  or public.has_workspace_capability(workspace_id, 'view_reports')
  or (
    public.is_workforce_member(workspace_id)
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);

drop policy if exists "Employees read time events" on public.time_events;
create policy "Employees read time events" on public.time_events for select using (
  public.can_manage_timekeeping_settings(workspace_id)
  or public.can_manage_time_entries(workspace_id)
  or (
    public.is_workforce_member(workspace_id)
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);

drop policy if exists "Admins manage payroll periods" on public.payroll_periods;
create policy "Authorized users manage payroll periods" on public.payroll_periods for all
using (public.can_manage_payroll(workspace_id)) with check (public.can_manage_payroll(workspace_id));

drop policy if exists "Employees read own payroll periods" on public.payroll_periods;
create policy "Employees read own payroll periods" on public.payroll_periods for select using (
  public.can_manage_payroll(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_payroll')
  or public.has_workspace_capability(workspace_id, 'view_reports')
  or (
    public.is_workforce_member(workspace_id)
    and exists (
      select 1 from public.payroll_items pi
      join public.employee_profiles ep on ep.id = pi.employee_profile_id
      where pi.payroll_period_id = payroll_periods.id and ep.user_id = auth.uid()
    )
  )
);

drop policy if exists "Employees read payroll items" on public.payroll_items;
create policy "Employees read payroll items" on public.payroll_items for select using (
  public.can_manage_payroll(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_payroll')
  or public.has_workspace_capability(workspace_id, 'view_reports')
  or (
    public.is_workforce_member(workspace_id)
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);
drop policy if exists "Admins manage payroll items" on public.payroll_items;
create policy "Authorized users manage payroll items" on public.payroll_items for all
using (public.can_manage_payroll(workspace_id)) with check (public.can_manage_payroll(workspace_id));

drop policy if exists "Admins manage payroll rules" on public.payroll_rules;
drop policy if exists "Owners manage payroll rules" on public.payroll_rules;
create policy "Authorized users manage payroll rules" on public.payroll_rules for all
using (public.can_manage_payroll(workspace_id)) with check (public.can_manage_payroll(workspace_id));

drop policy if exists "Admins manage holidays" on public.workforce_holidays;
create policy "Authorized users manage holidays" on public.workforce_holidays for all
using (public.can_manage_hr(workspace_id)) with check (public.can_manage_hr(workspace_id));

drop policy if exists "Workforce admins read employee payroll fields" on public.employee_payroll_fields;
create policy "Authorized users read employee payroll fields" on public.employee_payroll_fields for select
using (public.can_manage_payroll(workspace_id) or public.has_workspace_capability(workspace_id, 'approve_payroll'));
drop policy if exists "Owners manage employee payroll fields" on public.employee_payroll_fields;
create policy "Authorized users manage employee payroll fields" on public.employee_payroll_fields for all
using (public.can_manage_payroll(workspace_id)) with check (public.can_manage_payroll(workspace_id));

create or replace function public.save_employee_payroll_details(
  target_employee_profile_id uuid,
  new_compensation_type text,
  new_compensation_amount text,
  new_tax_status text,
  new_bank_account text,
  new_government_ids jsonb,
  new_country_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_workspace_id uuid;
begin
  select workspace_id into target_workspace_id
  from public.employee_profiles where id = target_employee_profile_id;
  if target_workspace_id is null or not public.can_manage_payroll(target_workspace_id) then
    raise exception 'Payroll management access required.';
  end if;
  perform public.upsert_employee_sensitive_payroll(
    target_employee_profile_id, new_compensation_type, new_compensation_amount,
    new_tax_status, new_bank_account, new_government_ids, new_country_fields
  );
end;
$$;

create or replace function public.read_employee_payroll_details(target_employee_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_workspace_id uuid;
begin
  select workspace_id into target_workspace_id
  from public.employee_profiles where id = target_employee_profile_id;
  if target_workspace_id is null or not (
    public.can_manage_payroll(target_workspace_id)
    or public.has_workspace_capability(target_workspace_id, 'approve_payroll')
  ) then
    raise exception 'Payroll access required.';
  end if;
  return public.get_employee_sensitive_payroll(target_employee_profile_id);
end;
$$;

create or replace function public.calculate_payroll(target_payroll_period_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare target_workspace_id uuid;
begin
  select workspace_id into target_workspace_id
  from public.payroll_periods where id = target_payroll_period_id;
  if target_workspace_id is null or not public.can_manage_payroll(target_workspace_id) then
    raise exception 'Payroll management access required.';
  end if;
  return public.generate_payroll(target_payroll_period_id);
end;
$$;

create or replace function public.set_payroll_period_status(
  target_payroll_period_id uuid,
  requested_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare period public.payroll_periods%rowtype;
begin
  select * into period from public.payroll_periods
  where id = target_payroll_period_id for update;
  if period.id is null then raise exception 'Payroll period not found.'; end if;

  if requested_status = 'approved' then
    if period.status <> 'calculated' then raise exception 'Only calculated payroll can be approved.'; end if;
    if not public.has_workspace_capability(period.workspace_id, 'approve_payroll') then
      raise exception 'Payroll approval access required.';
    end if;
    update public.payroll_periods
    set status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now()
    where id = period.id;
  elsif requested_status = 'paid' then
    if period.status <> 'approved' then raise exception 'Only approved payroll can be marked paid.'; end if;
    if not public.can_manage_payroll(period.workspace_id) then
      raise exception 'Payroll management access required.';
    end if;
    update public.payroll_periods set status = 'paid', updated_at = now() where id = period.id;
  else
    raise exception 'Unsupported payroll status transition.';
  end if;
end;
$$;

drop policy if exists "Workforce members read employee files" on storage.objects;
create policy "Workforce members read employee files" on storage.objects for select to authenticated using (
  bucket_id = 'employee-documents' and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.can_manage_hr(((storage.foldername(name))[1])::uuid)
  )
);
drop policy if exists "Workforce members upload employee files" on storage.objects;
create policy "Workforce members upload employee files" on storage.objects for insert to authenticated with check (
  bucket_id = 'employee-documents'
  and public.is_workforce_member(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.can_manage_hr(((storage.foldername(name))[1])::uuid)
  )
);
drop policy if exists "Workforce admins delete employee files" on storage.objects;
create policy "Authorized users delete employee files" on storage.objects for delete to authenticated using (
  bucket_id = 'employee-documents'
  and public.can_manage_hr(((storage.foldername(name))[1])::uuid)
);

-- Append-only business audit events.
create or replace function public.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  target_workspace uuid;
  target_record uuid;
begin
  target_workspace := coalesce(nullif(new_row->>'workspace_id', ''), nullif(old_row->>'workspace_id', ''))::uuid;
  target_record := coalesce(nullif(new_row->>'id', ''), nullif(old_row->>'id', ''),
    nullif(new_row->>'user_id', ''), nullif(old_row->>'user_id', ''))::uuid;
  if target_workspace is not null then
    insert into public.audit_logs (workspace_id, actor_id, event, target_table, target_id, metadata)
    values (
      target_workspace,
      auth.uid(),
      lower(tg_table_name || '.' || tg_op),
      tg_table_name,
      target_record,
      jsonb_strip_nulls(jsonb_build_object(
        'old_role', old_row->>'role', 'new_role', new_row->>'role',
        'old_status', old_row->>'status', 'new_status', new_row->>'status',
        'old_archived_at', old_row->>'archived_at', 'new_archived_at', new_row->>'archived_at'
      ))
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare audited_table text;
begin
  foreach audited_table in array array[
    'memberships', 'spaces', 'posts', 'tasks', 'knowledge_articles',
    'workspace_capabilities', 'employee_profiles', 'leave_requests',
    'time_entries', 'payroll_periods'
  ] loop
    execute format('drop trigger if exists audit_%I_changes on public.%I', audited_table, audited_table);
    execute format(
      'create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_business_change()',
      audited_table, audited_table
    );
  end loop;
end $$;

drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Authorized users read audit logs"
on public.audit_logs for select
using (public.has_workspace_capability(workspace_id, 'view_audit'));

create or replace function public.update_member_role(target_membership_id uuid, new_role public.workspace_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_membership public.memberships%rowtype;
begin
  select * into target_membership from public.memberships where id = target_membership_id;
  if target_membership.id is null then raise exception 'Membership not found.'; end if;
  if not public.has_workspace_capability(target_membership.workspace_id, 'manage_members') then
    raise exception 'Member management access required.';
  end if;
  if target_membership.role = 'owner' or new_role = 'owner' then
    raise exception 'The Owner role cannot be changed here.';
  end if;
  update public.memberships set role = new_role where id = target_membership_id;
end;
$$;

create or replace function public.rename_room(target_space_id uuid, new_name text, new_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_room public.spaces%rowtype;
begin
  select * into target_room from public.spaces where id = target_space_id;
  if target_room.id is null then raise exception 'Room not found.'; end if;
  if not (
    public.has_workspace_capability(target_room.workspace_id, 'manage_rooms')
    or (
      target_room.created_by = auth.uid()
      and public.has_workspace_role(target_room.workspace_id, array['member']::public.workspace_role[])
    )
  ) then
    raise exception 'Room management access required.';
  end if;
  if nullif(trim(new_name), '') is null then raise exception 'Room name is required.'; end if;
  update public.spaces set name = trim(new_name), slug = new_slug where id = target_space_id;
end;
$$;

create or replace function public.archive_completed_task(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_task public.tasks%rowtype;
begin
  select * into target_task from public.tasks where id = target_task_id;
  if target_task.id is null then raise exception 'Task not found.'; end if;
  if not (
    public.has_workspace_role(target_task.workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
    or target_task.assignee_id = auth.uid()
    or target_task.created_by = auth.uid()
  ) then
    raise exception 'Task access required.';
  end if;
  if target_task.status not in ('done', 'canceled') then
    raise exception 'Only completed or canceled tasks can be archived.';
  end if;
  update public.tasks set archived_at = now() where id = target_task_id;
end;
$$;

create or replace function public.create_workspace_invitation(
  target_workspace_id uuid,
  invitee_email text,
  invitee_role public.workspace_role default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare normalized_email text := lower(trim(invitee_email)); invite_token uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to invite members.'; end if;
  if not public.has_workspace_capability(target_workspace_id, 'manage_members') then
    raise exception 'Member management access required.';
  end if;
  if normalized_email = '' then raise exception 'Invite email is required.'; end if;
  if invitee_role = 'owner' then raise exception 'Owner role cannot be assigned by invite.'; end if;
  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
  values (target_workspace_id, normalized_email, invitee_role, auth.uid())
  returning token into invite_token;
  return invite_token;
end;
$$;

revoke all on function public.has_workspace_capability(uuid, text) from public, anon;
grant execute on function public.has_workspace_capability(uuid, text) to authenticated;
revoke all on function public.save_own_private_profile(text, text, text) from public, anon;
grant execute on function public.save_own_private_profile(text, text, text) to authenticated;
revoke all on function public.can_manage_hr(uuid) from public, anon;
grant execute on function public.can_manage_hr(uuid) to authenticated;
revoke all on function public.can_manage_payroll(uuid) from public, anon;
grant execute on function public.can_manage_payroll(uuid) to authenticated;
revoke execute on function public.upsert_employee_sensitive_payroll(uuid, text, text, text, text, jsonb, jsonb) from authenticated;
revoke execute on function public.get_employee_sensitive_payroll(uuid) from authenticated;
revoke execute on function public.generate_payroll(uuid) from authenticated;
revoke all on function public.save_employee_payroll_details(uuid, text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_employee_payroll_details(uuid, text, text, text, text, jsonb, jsonb) to authenticated;
revoke all on function public.read_employee_payroll_details(uuid) from public, anon;
grant execute on function public.read_employee_payroll_details(uuid) to authenticated;
revoke all on function public.calculate_payroll(uuid) from public, anon;
grant execute on function public.calculate_payroll(uuid) to authenticated;
revoke all on function public.set_payroll_period_status(uuid, text) from public, anon;
grant execute on function public.set_payroll_period_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
