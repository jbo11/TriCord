alter table public.employee_timekeeping_policies
  add column if not exists pending_requirements jsonb not null default '{}'::jsonb,
  add column if not exists pending_requested_at timestamptz,
  add column if not exists pending_requested_by uuid references auth.users(id),
  add column if not exists accepted_requirements_at timestamptz,
  add column if not exists declined_requirements_at timestamptz;

create or replace function public.respond_to_attendance_policy_requirements(
  target_employee_profile_id uuid,
  accept_requirements boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_employee public.employee_profiles%rowtype;
  target_policy public.employee_timekeeping_policies%rowtype;
  pending jsonb;
begin
  select * into target_employee
  from public.employee_profiles
  where id = target_employee_profile_id;

  if target_employee.id is null then
    raise exception 'Employee profile not found.';
  end if;

  if target_employee.user_id <> auth.uid() then
    raise exception 'You can only respond to your own attendance policy.';
  end if;

  select * into target_policy
  from public.employee_timekeeping_policies
  where employee_profile_id = target_employee_profile_id
  for update;

  if target_policy.employee_profile_id is null then
    raise exception 'Attendance policy not found.';
  end if;

  pending := coalesce(target_policy.pending_requirements, '{}'::jsonb);
  if pending = '{}'::jsonb then
    return;
  end if;

  if accept_requirements then
    update public.employee_timekeeping_policies
    set
      capture_location = case when pending ? 'capture_location' then (pending->>'capture_location')::boolean else capture_location end,
      capture_ip = case when pending ? 'capture_ip' then (pending->>'capture_ip')::boolean else capture_ip end,
      capture_device = case when pending ? 'capture_device' then (pending->>'capture_device')::boolean else capture_device end,
      require_selfie = case when pending ? 'require_selfie' then (pending->>'require_selfie')::boolean else require_selfie end,
      enforce_geofence = case when pending ? 'enforce_geofence' then (pending->>'enforce_geofence')::boolean else enforce_geofence end,
      pending_requirements = '{}'::jsonb,
      pending_requested_at = null,
      pending_requested_by = null,
      accepted_requirements_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
    where employee_profile_id = target_employee_profile_id;
  else
    update public.employee_timekeeping_policies
    set
      pending_requirements = '{}'::jsonb,
      pending_requested_at = null,
      pending_requested_by = null,
      declined_requirements_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
    where employee_profile_id = target_employee_profile_id;
  end if;
end;
$$;

revoke all on function public.respond_to_attendance_policy_requirements(uuid, boolean) from public, anon;
grant execute on function public.respond_to_attendance_policy_requirements(uuid, boolean) to authenticated;
