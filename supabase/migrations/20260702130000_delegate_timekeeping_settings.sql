-- Separate Admin access to timekeeping configuration from attendance editing.

alter table public.workforce_permissions
  add column if not exists manage_timekeeping_settings boolean not null default false;

update public.employee_timekeeping_policies set enabled = true where not enabled;

create or replace function public.can_manage_timekeeping_settings(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_role(target_workspace_id, array['owner']::public.workspace_role[])
    or (
      public.has_workspace_role(target_workspace_id, array['admin']::public.workspace_role[])
      and exists (
        select 1 from public.workforce_permissions
        where workspace_id = target_workspace_id
          and user_id = auth.uid()
          and manage_timekeeping_settings
      )
    );
$$;

drop policy if exists "Employees read timekeeping policy" on public.employee_timekeeping_policies;
create policy "Employees read timekeeping policy" on public.employee_timekeeping_policies for select using (
  public.can_manage_timekeeping_settings(workspace_id)
  or exists (
    select 1 from public.employee_profiles ep
    where ep.id = employee_profile_id and ep.user_id = auth.uid()
  )
);

drop policy if exists "Owners manage employee timekeeping policies" on public.employee_timekeeping_policies;
drop policy if exists "Authorized users manage employee timekeeping policies" on public.employee_timekeeping_policies;
create policy "Authorized users manage employee timekeeping policies" on public.employee_timekeeping_policies for all
using (public.can_manage_timekeeping_settings(workspace_id))
with check (public.can_manage_timekeeping_settings(workspace_id));

create or replace function public.provision_employee_timekeeping_policy()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_employee public.employee_profiles%rowtype;
begin
  select * into target_employee
  from public.employee_profiles
  where workspace_id = new.workspace_id and user_id = new.user_id;

  if target_employee.id is not null and new.role in ('admin', 'member') then
    insert into public.employee_timekeeping_policies (
      employee_profile_id, workspace_id, enabled, capture_location, capture_ip, capture_device,
      require_selfie, enforce_geofence, office_latitude, office_longitude,
      geofence_radius_meters, standard_daily_hours, grace_period_minutes,
      workday_start, workday_end, workdays
    )
    select target_employee.id, new.workspace_id, true, ts.capture_location, ts.capture_ip, ts.capture_device,
      ts.require_selfie, ts.enforce_geofence, ts.office_latitude, ts.office_longitude,
      ts.geofence_radius_meters, ts.standard_daily_hours, ts.grace_period_minutes,
      ts.workday_start, ts.workday_end, ts.workdays
    from public.timekeeping_settings ts where ts.workspace_id = new.workspace_id
    on conflict (employee_profile_id) do update
    set enabled = true, updated_at = now();
  elsif target_employee.id is not null then
    update public.employee_timekeeping_policies
    set enabled = false, updated_at = now()
    where employee_profile_id = target_employee.id;
  end if;
  return new;
end;
$$;

revoke all on function public.can_manage_timekeeping_settings(uuid) from public, anon;
grant execute on function public.can_manage_timekeeping_settings(uuid) to authenticated;

notify pgrst, 'reload schema';
