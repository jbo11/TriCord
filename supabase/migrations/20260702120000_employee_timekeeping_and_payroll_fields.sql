-- Employee-scoped timekeeping requirements, delegated attendance permissions,
-- and employee-specific payroll fields.

create table if not exists public.workforce_permissions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  manage_time_entries boolean not null default false,
  granted_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.employee_timekeeping_policies (
  employee_profile_id uuid primary key references public.employee_profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  capture_location boolean not null default false,
  capture_ip boolean not null default false,
  capture_device boolean not null default false,
  require_selfie boolean not null default false,
  enforce_geofence boolean not null default false,
  office_latitude double precision,
  office_longitude double precision,
  geofence_radius_meters integer not null default 250 check (geofence_radius_meters between 25 and 50000),
  standard_daily_hours numeric(5,2) not null default 8 check (standard_daily_hours > 0 and standard_daily_hours <= 24),
  grace_period_minutes integer not null default 0 check (grace_period_minutes between 0 and 240),
  workday_start time not null default '09:00',
  workday_end time not null default '17:00',
  workdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  check (not enforce_geofence or (office_latitude is not null and office_longitude is not null))
);

create table if not exists public.employee_payroll_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  name text not null,
  item_kind text not null check (item_kind in ('earning', 'deduction')),
  calculation_type text not null check (calculation_type in ('fixed', 'percentage')),
  value numeric(12,4) not null check (value >= 0),
  country_code text,
  active boolean not null default true,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_profile_id, name)
);

create index if not exists workforce_permissions_workspace_idx on public.workforce_permissions (workspace_id, user_id);
create index if not exists employee_timekeeping_policies_workspace_idx on public.employee_timekeeping_policies (workspace_id, employee_profile_id);
create index if not exists employee_payroll_fields_employee_idx on public.employee_payroll_fields (employee_profile_id, active);

insert into public.employee_timekeeping_policies (
  employee_profile_id, workspace_id, capture_location, capture_ip, capture_device,
  require_selfie, enforce_geofence, office_latitude, office_longitude,
  geofence_radius_meters, standard_daily_hours, grace_period_minutes,
  workday_start, workday_end, workdays
)
select ep.id, ep.workspace_id, ts.capture_location, ts.capture_ip, ts.capture_device,
  ts.require_selfie, ts.enforce_geofence, ts.office_latitude, ts.office_longitude,
  ts.geofence_radius_meters, ts.standard_daily_hours, ts.grace_period_minutes,
  ts.workday_start, ts.workday_end, ts.workdays
from public.employee_profiles ep
join public.memberships m on m.workspace_id = ep.workspace_id and m.user_id = ep.user_id
join public.timekeeping_settings ts on ts.workspace_id = ep.workspace_id
where m.role in ('admin', 'member')
on conflict (employee_profile_id) do nothing;

create or replace function public.provision_employee_timekeeping_policy()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_employee public.employee_profiles%rowtype;
begin
  select * into target_employee
  from public.employee_profiles
  where workspace_id = new.workspace_id and user_id = new.user_id;

  if target_employee.id is not null and new.role in ('admin', 'member') then
    insert into public.employee_timekeeping_policies (
      employee_profile_id, workspace_id, capture_location, capture_ip, capture_device,
      require_selfie, enforce_geofence, office_latitude, office_longitude,
      geofence_radius_meters, standard_daily_hours, grace_period_minutes,
      workday_start, workday_end, workdays
    )
    select target_employee.id, new.workspace_id, ts.capture_location, ts.capture_ip, ts.capture_device,
      ts.require_selfie, ts.enforce_geofence, ts.office_latitude, ts.office_longitude,
      ts.geofence_radius_meters, ts.standard_daily_hours, ts.grace_period_minutes,
      ts.workday_start, ts.workday_end, ts.workdays
    from public.timekeeping_settings ts where ts.workspace_id = new.workspace_id
    on conflict (employee_profile_id) do nothing;
  elsif target_employee.id is not null then
    update public.employee_timekeeping_policies
    set enabled = false, updated_at = now()
    where employee_profile_id = target_employee.id;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_provision_employee_timekeeping_policy on public.memberships;
create trigger zz_provision_employee_timekeeping_policy
after insert or update of role on public.memberships
for each row execute function public.provision_employee_timekeeping_policy();

create or replace function public.can_manage_time_entries(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_role(target_workspace_id, array['owner']::public.workspace_role[])
    or (
      public.has_workspace_role(target_workspace_id, array['admin']::public.workspace_role[])
      and exists (
        select 1 from public.workforce_permissions
        where workspace_id = target_workspace_id
          and user_id = auth.uid()
          and manage_time_entries
      )
    );
$$;

alter table public.workforce_permissions enable row level security;
alter table public.employee_timekeeping_policies enable row level security;
alter table public.employee_payroll_fields enable row level security;

drop policy if exists "Users read workforce permissions" on public.workforce_permissions;
create policy "Users read workforce permissions" on public.workforce_permissions for select using (
  user_id = auth.uid() or public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
);
drop policy if exists "Owners manage workforce permissions" on public.workforce_permissions;
create policy "Owners manage workforce permissions" on public.workforce_permissions for all
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

drop policy if exists "Employees read timekeeping policy" on public.employee_timekeeping_policies;
create policy "Employees read timekeeping policy" on public.employee_timekeeping_policies for select using (
  public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
  or exists (
    select 1 from public.employee_profiles ep
    where ep.id = employee_profile_id and ep.user_id = auth.uid()
  )
);
drop policy if exists "Owners manage employee timekeeping policies" on public.employee_timekeeping_policies;
create policy "Owners manage employee timekeeping policies" on public.employee_timekeeping_policies for all
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

drop policy if exists "Workforce admins read employee payroll fields" on public.employee_payroll_fields;
create policy "Workforce admins read employee payroll fields" on public.employee_payroll_fields for select
using (public.is_workforce_admin(workspace_id));
drop policy if exists "Owners manage employee payroll fields" on public.employee_payroll_fields;
create policy "Owners manage employee payroll fields" on public.employee_payroll_fields for all
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

drop policy if exists "Admins manage time entries" on public.time_entries;
drop policy if exists "Authorized users update time entries" on public.time_entries;
create policy "Authorized users update time entries" on public.time_entries for update
using (public.can_manage_time_entries(workspace_id))
with check (public.can_manage_time_entries(workspace_id));
drop policy if exists "Authorized users delete time entries" on public.time_entries;
create policy "Authorized users delete time entries" on public.time_entries for delete
using (public.can_manage_time_entries(workspace_id));

drop policy if exists "Admins manage payroll rules" on public.payroll_rules;
drop policy if exists "Owners manage payroll rules" on public.payroll_rules;
create policy "Owners manage payroll rules" on public.payroll_rules for all
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

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

create or replace function public.generate_payroll(target_payroll_period_id uuid)
returns integer language plpgsql security definer set search_path = public, private as $$
declare period public.payroll_periods%rowtype; encryption_secret text; generated_count integer := 0;
begin
  select * into period from public.payroll_periods where id = target_payroll_period_id for update;
  if period.id is null or not public.is_workforce_admin(period.workspace_id) then raise exception 'Payroll access required.'; end if;
  if period.status in ('approved', 'paid', 'void') then raise exception 'This payroll period can no longer be recalculated.'; end if;
  select secret into encryption_secret from private.workforce_encryption_keys where id = true;

  insert into public.payroll_items (workspace_id, payroll_period_id, employee_profile_id, regular_hours, overtime_hours, gross_pay, deductions, net_pay, calculation_details)
  select period.workspace_id, period.id, ep.id, totals.regular_hours, totals.overtime_hours,
    round(gross.base_gross + rules.earnings, 2), round(rules.deductions, 2),
    round(greatest(0, gross.base_gross + rules.earnings - rules.deductions), 2),
    jsonb_build_object('compensation_type', s.compensation_type, 'rate', amount.rate, 'days_worked', totals.days_worked, 'rule_earnings', rules.earnings, 'rule_deductions', rules.deductions)
  from public.employee_profiles ep
  join public.employee_sensitive_payroll s on s.employee_profile_id = ep.id
  cross join lateral (select coalesce(extensions.pgp_sym_decrypt(s.compensation_amount_encrypted, encryption_secret), '0')::numeric as rate) amount
  cross join lateral (
    select coalesce(sum(least(8, worked.hours)), 0) as regular_hours,
      coalesce(sum(greatest(0, worked.hours - 8)), 0) as overtime_hours,
      count(*) filter (where worked.hours > 0) as days_worked
    from (
      select greatest(0, extract(epoch from (coalesce(te.clock_out, now()) - te.clock_in)) / 3600 - te.break_seconds / 3600.0) as hours
      from public.time_entries te where te.employee_profile_id = ep.id and te.work_date between period.period_start and period.period_end
    ) worked
  ) totals
  cross join lateral (
    select case s.compensation_type
      when 'hourly' then totals.regular_hours * amount.rate + totals.overtime_hours * amount.rate * 1.5
      when 'daily' then totals.days_worked * amount.rate
      when 'weekly' then amount.rate * ((period.period_end - period.period_start + 1)::numeric / 7)
      when 'semimonthly' then amount.rate
      when 'monthly' then amount.rate
      when 'annual' then amount.rate * ((period.period_end - period.period_start + 1)::numeric / 365.25)
      else 0 end as base_gross
  ) gross
  cross join lateral (
    select
      coalesce(sum(case when applied.rule_kind = 'earning' then case applied.calculation_type when 'percentage' then gross.base_gross * applied.value / 100 else applied.value end else 0 end), 0) as earnings,
      coalesce(sum(case when applied.rule_kind = 'deduction' then case applied.calculation_type when 'percentage' then gross.base_gross * applied.value / 100 else applied.value end else 0 end), 0) as deductions
    from (
      select pr.rule_kind, pr.calculation_type, pr.value
      from public.payroll_rules pr
      where pr.workspace_id = period.workspace_id and pr.active
        and (pr.country_code is null or pr.country_code = (select country_code from public.workforce_settings where workspace_id = period.workspace_id))
      union all
      select epf.item_kind, epf.calculation_type, epf.value
      from public.employee_payroll_fields epf
      where epf.employee_profile_id = ep.id and epf.active
        and (epf.country_code is null or epf.country_code = (select country_code from public.workforce_settings where workspace_id = period.workspace_id))
    ) applied
  ) rules
  where ep.workspace_id = period.workspace_id and ep.employment_status = 'active'
  on conflict (payroll_period_id, employee_profile_id) do update set
    regular_hours = excluded.regular_hours, overtime_hours = excluded.overtime_hours,
    gross_pay = excluded.gross_pay, deductions = excluded.deductions, net_pay = excluded.net_pay,
    calculation_details = excluded.calculation_details, updated_at = now();

  get diagnostics generated_count = row_count;
  update public.payroll_periods set status = 'calculated', updated_at = now() where id = period.id;
  return generated_count;
end;
$$;

revoke all on function public.can_manage_time_entries(uuid) from public, anon;
grant execute on function public.can_manage_time_entries(uuid) to authenticated;
revoke all on function public.record_time_event(uuid, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.record_time_event(uuid, text, double precision, double precision, text, text) to authenticated;
revoke all on function public.generate_payroll(uuid) from public, anon;
grant execute on function public.generate_payroll(uuid) to authenticated;

do $$
declare target_table text;
begin
  foreach target_table in array array['workforce_permissions', 'employee_timekeeping_policies', 'employee_payroll_fields'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
