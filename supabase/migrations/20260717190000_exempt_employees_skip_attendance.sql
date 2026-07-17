create or replace function public.record_time_event(
  target_workspace_id uuid, requested_action text, event_latitude double precision default null,
  event_longitude double precision default null, event_device_information text default null,
  event_selfie_path text default null
) returns public.time_entries language plpgsql security definer set search_path = public as $$
declare
  employee public.employee_profiles%rowtype;
  employee_policy public.employee_timekeeping_policies%rowtype;
  hub_timezone text; local_work_date date; active_entry public.time_entries%rowtype;
  event_kind text; distance_meters numeric; request_headers jsonb := '{}'::jsonb; captured_ip inet;
begin
  if requested_action not in ('clock_in', 'clock_out', 'break_start', 'break_end') then raise exception 'Invalid timekeeping action.'; end if;
  if not public.has_workspace_role(target_workspace_id, array['admin', 'member']::public.workspace_role[]) then
    raise exception 'Only Admins and Members can use timekeeping.';
  end if;
  select * into employee from public.employee_profiles where workspace_id = target_workspace_id and user_id = auth.uid();
  if employee.id is null then raise exception 'Employee profile not found.'; end if;
  if coalesce(employee.exemption_status, 'non_exempt') = 'exempt' then
    raise exception 'Attendance tracking is not available for exempt employees.';
  end if;
  select * into employee_policy from public.employee_timekeeping_policies where employee_profile_id = employee.id;
  if employee_policy.employee_profile_id is null or not employee_policy.enabled then
    raise exception 'Timekeeping is not enabled for this employee.';
  end if;
  select timezone into hub_timezone from public.workforce_settings where workspace_id = target_workspace_id;
  local_work_date := (now() at time zone coalesce(hub_timezone, 'UTC'))::date;

  if (employee_policy.capture_location or employee_policy.enforce_geofence) and (event_latitude is null or event_longitude is null) then
    raise exception 'Location is required for this action.';
  end if;
  if employee_policy.require_selfie and requested_action = 'clock_in' and nullif(event_selfie_path, '') is null then
    raise exception 'A selfie is required to clock in.';
  end if;
  if employee_policy.enforce_geofence then
    distance_meters := 6371000 * acos(least(1, greatest(-1,
      cos(radians(employee_policy.office_latitude)) * cos(radians(event_latitude)) * cos(radians(event_longitude) - radians(employee_policy.office_longitude)) +
      sin(radians(employee_policy.office_latitude)) * sin(radians(event_latitude))
    )));
    if distance_meters > employee_policy.geofence_radius_meters then raise exception 'You are outside the permitted clock-in area.'; end if;
  end if;

  select * into active_entry from public.time_entries
  where employee_profile_id = employee.id and clock_out is null order by clock_in desc limit 1 for update;

  if requested_action = 'clock_in' then
    if active_entry.id is not null then raise exception 'You are already clocked in.'; end if;
    insert into public.time_entries (workspace_id, employee_profile_id, work_date, clock_in)
    values (target_workspace_id, employee.id, local_work_date, now()) returning * into active_entry;
    event_kind := 'clock_in';
  elsif active_entry.id is null then
    raise exception 'Clock in before using this action.';
  elsif requested_action = 'break_start' then
    if active_entry.break_started_at is not null then raise exception 'A break is already active.'; end if;
    update public.time_entries set break_started_at = now(), updated_at = now() where id = active_entry.id returning * into active_entry;
    event_kind := 'break_start';
  elsif requested_action = 'break_end' then
    if active_entry.break_started_at is null then raise exception 'No active break was found.'; end if;
    update public.time_entries set break_seconds = break_seconds + extract(epoch from (now() - break_started_at))::integer,
      break_started_at = null, updated_at = now() where id = active_entry.id returning * into active_entry;
    event_kind := 'break_end';
  else
    if active_entry.break_started_at is not null then
      active_entry.break_seconds := active_entry.break_seconds + extract(epoch from (now() - active_entry.break_started_at))::integer;
    end if;
    update public.time_entries set clock_out = now(), break_seconds = active_entry.break_seconds,
      break_started_at = null, updated_at = now() where id = active_entry.id returning * into active_entry;
    event_kind := 'clock_out';
  end if;

  begin request_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb; exception when others then request_headers := '{}'::jsonb; end;
  if employee_policy.capture_ip then
    begin captured_ip := split_part(coalesce(request_headers->>'x-forwarded-for', request_headers->>'x-real-ip'), ',', 1)::inet; exception when others then captured_ip := null; end;
  end if;
  insert into public.time_events (workspace_id, employee_profile_id, time_entry_id, event_type, latitude, longitude, map_url, ip_address, device_information, selfie_path, distance_from_office_meters)
  values (target_workspace_id, employee.id, active_entry.id, event_kind,
    case when employee_policy.capture_location or employee_policy.enforce_geofence then event_latitude end,
    case when employee_policy.capture_location or employee_policy.enforce_geofence then event_longitude end,
    case when event_latitude is not null and event_longitude is not null then 'https://www.openstreetmap.org/?mlat=' || event_latitude || '&mlon=' || event_longitude end,
    captured_ip, case when employee_policy.capture_device then left(event_device_information, 1000) end,
    case when employee_policy.require_selfie and requested_action = 'clock_in' then event_selfie_path end, distance_meters);
  return active_entry;
end;
$$;

revoke all on function public.record_time_event(uuid, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.record_time_event(uuid, text, double precision, double precision, text, text) to authenticated;
