-- TriCord workforce suite: international HR, timekeeping, payroll, leave, and reports.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.workforce_encryption_keys (
  id boolean primary key default true check (id),
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

insert into private.workforce_encryption_keys (id) values (true) on conflict (id) do nothing;

create table if not exists public.workforce_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  country_code text not null default 'US',
  currency_code text not null default 'USD',
  locale text not null default 'en-US',
  timezone text not null default 'UTC',
  date_format text not null default 'MM/DD/YYYY',
  payroll_frequency text not null default 'biweekly' check (payroll_frequency in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  first_day_of_week smallint not null default 0 check (first_day_of_week between 0 and 6),
  country_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timekeeping_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  check (not enforce_geofence or (office_latitude is not null and office_longitude is not null))
);

create table if not exists public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  address text,
  contact_number text,
  birthday date,
  emergency_contact_name text,
  emergency_contact_number text,
  employee_number text,
  department text,
  position text,
  manager_user_id uuid references public.users(id) on delete set null,
  employment_status text not null default 'active' check (employment_status in ('active', 'inactive', 'on_leave', 'terminated')),
  hire_date date,
  employment_type text check (employment_type is null or employment_type in ('full_time', 'part_time', 'contractor', 'temporary', 'intern')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  unique (workspace_id, employee_number)
);

create table if not exists public.employee_sensitive_payroll (
  employee_profile_id uuid primary key references public.employee_profiles(id) on delete cascade,
  compensation_type text not null default 'hourly' check (compensation_type in ('hourly', 'daily', 'weekly', 'semimonthly', 'monthly', 'annual')),
  compensation_amount_encrypted bytea,
  tax_status_encrypted bytea,
  bank_account_encrypted bytea,
  government_ids_encrypted bytea,
  country_fields_encrypted bytea,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  document_type text not null check (document_type in ('resume', 'offer_letter', 'employment_contract', 'nda', 'tax_form', 'identity', 'certificate', 'other')),
  filename text not null,
  bucket text not null default 'employee-documents',
  object_path text not null,
  uploaded_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.performance_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  record_type text not null check (record_type in ('review', 'achievement', 'warning', 'goal')),
  title text not null,
  details text,
  review_date date not null default current_date,
  rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5)),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  code text not null,
  paid boolean not null default true,
  annual_allowance numeric(6,2) not null default 0,
  country_code text,
  active boolean not null default true,
  unique (workspace_id, code)
);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  year integer not null,
  allocated numeric(7,2) not null default 0,
  used numeric(7,2) not null default 0,
  unique (employee_profile_id, leave_type_id, year)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  start_date date not null,
  end_date date not null,
  days numeric(7,2) not null check (days > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  work_date date not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_started_at timestamptz,
  break_seconds integer not null default 0 check (break_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_profile_id, work_date, clock_in),
  check (clock_out is null or clock_out >= clock_in)
);

create table if not exists public.time_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  event_type text not null check (event_type in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  occurred_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  map_url text,
  ip_address inet,
  device_information text,
  selfie_path text,
  distance_from_office_meters numeric(10,2)
);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'draft' check (status in ('draft', 'calculated', 'approved', 'paid', 'void')),
  currency_code text not null,
  created_by uuid not null references public.users(id),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_start, period_end),
  check (period_end >= period_start)
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  regular_hours numeric(9,2) not null default 0,
  overtime_hours numeric(9,2) not null default 0,
  gross_pay numeric(14,2) not null default 0,
  deductions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  calculation_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, employee_profile_id)
);

create index if not exists employee_profiles_workspace_idx on public.employee_profiles (workspace_id, employment_status, department);
create index if not exists time_entries_workspace_date_idx on public.time_entries (workspace_id, work_date, employee_profile_id);
create index if not exists time_events_entry_idx on public.time_events (time_entry_id, occurred_at);
create index if not exists leave_requests_workspace_status_idx on public.leave_requests (workspace_id, status, start_date);
create index if not exists payroll_periods_workspace_date_idx on public.payroll_periods (workspace_id, period_start desc);
create index if not exists payroll_items_employee_idx on public.payroll_items (employee_profile_id, payroll_period_id);

insert into public.workforce_settings (workspace_id, timezone)
select id, coalesce((select timezone from public.users where id = workspaces.owner_id), 'UTC') from public.workspaces
on conflict (workspace_id) do nothing;

insert into public.timekeeping_settings (workspace_id)
select id from public.workspaces on conflict (workspace_id) do nothing;

insert into public.employee_profiles (workspace_id, user_id, first_name, last_name, contact_number, address)
select m.workspace_id, m.user_id,
       nullif(split_part(coalesce(u.full_name, u.display_name), ' ', 1), ''),
       case when position(' ' in coalesce(u.full_name, u.display_name)) > 0 then nullif(trim(substring(coalesce(u.full_name, u.display_name) from position(' ' in coalesce(u.full_name, u.display_name)) + 1)), '') end,
       u.phone, u.address
from public.memberships m join public.users u on u.id = m.user_id
on conflict (workspace_id, user_id) do nothing;

insert into public.leave_types (workspace_id, name, code, paid, annual_allowance)
select w.id, defaults.name, defaults.code, defaults.paid, defaults.allowance
from public.workspaces w
cross join (values
  ('Vacation Leave', 'vacation', true, 0::numeric),
  ('Sick Leave', 'sick', true, 0::numeric),
  ('Emergency Leave', 'emergency', true, 0::numeric),
  ('Unpaid Leave', 'unpaid', false, 0::numeric)
) as defaults(name, code, paid, allowance)
on conflict (workspace_id, code) do nothing;

create or replace function public.provision_workforce_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.employee_profiles (workspace_id, user_id, first_name, last_name, contact_number, address)
  select new.workspace_id, new.user_id,
         nullif(split_part(coalesce(u.full_name, u.display_name), ' ', 1), ''),
         case when position(' ' in coalesce(u.full_name, u.display_name)) > 0 then nullif(trim(substring(coalesce(u.full_name, u.display_name) from position(' ' in coalesce(u.full_name, u.display_name)) + 1)), '') end,
         u.phone, u.address
  from public.users u where u.id = new.user_id
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists provision_workforce_membership on public.memberships;
create trigger provision_workforce_membership after insert on public.memberships
for each row execute function public.provision_workforce_membership();

create or replace function public.provision_workforce_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workforce_settings (workspace_id) values (new.id) on conflict do nothing;
  insert into public.timekeeping_settings (workspace_id) values (new.id) on conflict do nothing;
  insert into public.leave_types (workspace_id, name, code, paid) values
    (new.id, 'Vacation Leave', 'vacation', true),
    (new.id, 'Sick Leave', 'sick', true),
    (new.id, 'Emergency Leave', 'emergency', true),
    (new.id, 'Unpaid Leave', 'unpaid', false)
  on conflict (workspace_id, code) do nothing;
  return new;
end;
$$;

drop trigger if exists provision_workforce_workspace on public.workspaces;
create trigger provision_workforce_workspace after insert on public.workspaces
for each row execute function public.provision_workforce_workspace();

create or replace function public.is_workforce_admin(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_role(target_workspace_id, array['owner', 'admin']::public.workspace_role[]);
$$;

create or replace function public.is_workforce_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = target_workspace_id and user_id = auth.uid() and role <> 'guest'
  );
$$;

alter table public.workforce_settings enable row level security;
alter table public.timekeeping_settings enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.employee_sensitive_payroll enable row level security;
alter table public.employee_documents enable row level security;
alter table public.performance_records enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_events enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_items enable row level security;

drop policy if exists "Workforce members read settings" on public.workforce_settings;
create policy "Workforce members read settings" on public.workforce_settings for select using (public.is_workforce_member(workspace_id));
drop policy if exists "Owners manage workforce settings" on public.workforce_settings;
create policy "Owners manage workforce settings" on public.workforce_settings for all
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

drop policy if exists "Workforce members read timekeeping settings" on public.timekeeping_settings;
create policy "Workforce members read timekeeping settings" on public.timekeeping_settings for select using (public.is_workforce_member(workspace_id));
drop policy if exists "Owners manage timekeeping settings" on public.timekeeping_settings;
create policy "Owners manage timekeeping settings" on public.timekeeping_settings for all
using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

drop policy if exists "Employees read permitted profiles" on public.employee_profiles;
create policy "Employees read permitted profiles" on public.employee_profiles for select using (
  (user_id = auth.uid() and public.is_workforce_member(workspace_id)) or public.is_workforce_admin(workspace_id)
);
drop policy if exists "Admins manage employee profiles" on public.employee_profiles;
create policy "Admins manage employee profiles" on public.employee_profiles for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

drop policy if exists "Employees read permitted documents" on public.employee_documents;
create policy "Employees read permitted documents" on public.employee_documents for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  ))
);
drop policy if exists "Employees upload own documents" on public.employee_documents;
create policy "Employees upload own documents" on public.employee_documents for insert with check (
  uploaded_by = auth.uid() and (public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  )))
);
drop policy if exists "Admins delete employee documents" on public.employee_documents;
create policy "Admins delete employee documents" on public.employee_documents for delete using (public.is_workforce_admin(workspace_id));

drop policy if exists "Employees read own performance" on public.performance_records;
create policy "Employees read own performance" on public.performance_records for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  ))
);
drop policy if exists "Admins manage performance" on public.performance_records;
create policy "Admins manage performance" on public.performance_records for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

drop policy if exists "Workforce members read leave types" on public.leave_types;
create policy "Workforce members read leave types" on public.leave_types for select using (public.is_workforce_member(workspace_id));
drop policy if exists "Admins manage leave types" on public.leave_types;
create policy "Admins manage leave types" on public.leave_types for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

drop policy if exists "Employees read leave balances" on public.leave_balances;
create policy "Employees read leave balances" on public.leave_balances for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  ))
);
drop policy if exists "Admins manage leave balances" on public.leave_balances;
create policy "Admins manage leave balances" on public.leave_balances for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

drop policy if exists "Employees read leave requests" on public.leave_requests;
create policy "Employees read leave requests" on public.leave_requests for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  ))
);
drop policy if exists "Employees create leave requests" on public.leave_requests;
create policy "Employees create leave requests" on public.leave_requests for insert with check (
  status = 'pending' and (public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  )))
);
drop policy if exists "Admins manage leave requests" on public.leave_requests;
create policy "Admins manage leave requests" on public.leave_requests for update
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

drop policy if exists "Employees read time entries" on public.time_entries;
create policy "Employees read time entries" on public.time_entries for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  ))
);
drop policy if exists "Admins manage time entries" on public.time_entries;
create policy "Admins manage time entries" on public.time_entries for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

drop policy if exists "Employees read time events" on public.time_events;
create policy "Employees read time events" on public.time_events for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  ))
);

drop policy if exists "Admins manage payroll periods" on public.payroll_periods;
create policy "Admins manage payroll periods" on public.payroll_periods for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));
drop policy if exists "Employees read own payroll periods" on public.payroll_periods;
create policy "Employees read own payroll periods" on public.payroll_periods for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.payroll_items pi join public.employee_profiles ep on ep.id = pi.employee_profile_id
    where pi.payroll_period_id = payroll_periods.id and ep.user_id = auth.uid()
  ))
);
drop policy if exists "Employees read payroll items" on public.payroll_items;
create policy "Employees read payroll items" on public.payroll_items for select using (
  public.is_workforce_admin(workspace_id) or (public.is_workforce_member(workspace_id) and exists (
    select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid()
  ))
);
drop policy if exists "Admins manage payroll items" on public.payroll_items;
create policy "Admins manage payroll items" on public.payroll_items for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

create or replace function public.update_own_employee_profile(
  target_workspace_id uuid, new_first_name text, new_last_name text, new_address text,
  new_contact_number text, new_birthday date, new_emergency_name text, new_emergency_number text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_workforce_member(target_workspace_id) then raise exception 'Workforce access required.'; end if;
  update public.employee_profiles set
    first_name = nullif(trim(new_first_name), ''), last_name = nullif(trim(new_last_name), ''),
    address = nullif(trim(new_address), ''), contact_number = nullif(trim(new_contact_number), ''),
    birthday = new_birthday, emergency_contact_name = nullif(trim(new_emergency_name), ''),
    emergency_contact_number = nullif(trim(new_emergency_number), ''), updated_at = now()
  where workspace_id = target_workspace_id and user_id = auth.uid();
end;
$$;

create or replace function public.upsert_employee_sensitive_payroll(
  target_employee_profile_id uuid, new_compensation_type text, new_compensation_amount text,
  new_tax_status text, new_bank_account text, new_government_ids jsonb, new_country_fields jsonb
) returns void language plpgsql security definer set search_path = public, private as $$
declare target_workspace_id uuid; encryption_secret text;
begin
  select workspace_id into target_workspace_id from public.employee_profiles where id = target_employee_profile_id;
  if target_workspace_id is null or not public.is_workforce_admin(target_workspace_id) then raise exception 'HR payroll access required.'; end if;
  if new_compensation_type not in ('hourly', 'daily', 'weekly', 'semimonthly', 'monthly', 'annual') then raise exception 'Invalid compensation type.'; end if;
  select secret into encryption_secret from private.workforce_encryption_keys where id = true;
  insert into public.employee_sensitive_payroll (
    employee_profile_id, compensation_type, compensation_amount_encrypted, tax_status_encrypted,
    bank_account_encrypted, government_ids_encrypted, country_fields_encrypted, updated_by
  ) values (
    target_employee_profile_id, new_compensation_type,
    case when nullif(new_compensation_amount, '') is null then null else extensions.pgp_sym_encrypt(new_compensation_amount, encryption_secret) end,
    case when nullif(new_tax_status, '') is null then null else extensions.pgp_sym_encrypt(new_tax_status, encryption_secret) end,
    case when nullif(new_bank_account, '') is null then null else extensions.pgp_sym_encrypt(new_bank_account, encryption_secret) end,
    extensions.pgp_sym_encrypt(coalesce(new_government_ids, '{}'::jsonb)::text, encryption_secret),
    extensions.pgp_sym_encrypt(coalesce(new_country_fields, '{}'::jsonb)::text, encryption_secret), auth.uid()
  ) on conflict (employee_profile_id) do update set
    compensation_type = excluded.compensation_type,
    compensation_amount_encrypted = excluded.compensation_amount_encrypted,
    tax_status_encrypted = excluded.tax_status_encrypted,
    bank_account_encrypted = excluded.bank_account_encrypted,
    government_ids_encrypted = excluded.government_ids_encrypted,
    country_fields_encrypted = excluded.country_fields_encrypted,
    updated_at = now(), updated_by = auth.uid();
end;
$$;

create or replace function public.get_employee_sensitive_payroll(target_employee_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare result jsonb; target_workspace_id uuid; encryption_secret text;
begin
  select workspace_id into target_workspace_id from public.employee_profiles where id = target_employee_profile_id;
  if target_workspace_id is null or not public.is_workforce_admin(target_workspace_id) then raise exception 'HR payroll access required.'; end if;
  select secret into encryption_secret from private.workforce_encryption_keys where id = true;
  select jsonb_build_object(
    'compensation_type', s.compensation_type,
    'compensation_amount', case when s.compensation_amount_encrypted is null then '' else extensions.pgp_sym_decrypt(s.compensation_amount_encrypted, encryption_secret) end,
    'tax_status', case when s.tax_status_encrypted is null then '' else extensions.pgp_sym_decrypt(s.tax_status_encrypted, encryption_secret) end,
    'bank_account', case when s.bank_account_encrypted is null then '' else extensions.pgp_sym_decrypt(s.bank_account_encrypted, encryption_secret) end,
    'government_ids', case when s.government_ids_encrypted is null then '{}'::jsonb else extensions.pgp_sym_decrypt(s.government_ids_encrypted, encryption_secret)::jsonb end,
    'country_fields', case when s.country_fields_encrypted is null then '{}'::jsonb else extensions.pgp_sym_decrypt(s.country_fields_encrypted, encryption_secret)::jsonb end
  ) into result from public.employee_sensitive_payroll s where s.employee_profile_id = target_employee_profile_id;
  return coalesce(result, jsonb_build_object('compensation_type', 'hourly', 'compensation_amount', '', 'tax_status', '', 'bank_account', '', 'government_ids', '{}'::jsonb, 'country_fields', '{}'::jsonb));
end;
$$;

create or replace function public.record_time_event(
  target_workspace_id uuid, requested_action text, event_latitude double precision default null,
  event_longitude double precision default null, event_device_information text default null,
  event_selfie_path text default null
) returns public.time_entries language plpgsql security definer set search_path = public as $$
declare
  employee public.employee_profiles%rowtype; settings public.timekeeping_settings%rowtype;
  hub_timezone text; local_work_date date; active_entry public.time_entries%rowtype;
  event_kind text; distance_meters numeric; request_headers jsonb := '{}'::jsonb; captured_ip inet;
begin
  if requested_action not in ('clock_in', 'clock_out', 'break_start', 'break_end') then raise exception 'Invalid timekeeping action.'; end if;
  if not public.is_workforce_member(target_workspace_id) then raise exception 'Timekeeping access required.'; end if;
  select * into employee from public.employee_profiles where workspace_id = target_workspace_id and user_id = auth.uid();
  if employee.id is null then raise exception 'Employee profile not found.'; end if;
  select * into settings from public.timekeeping_settings where workspace_id = target_workspace_id;
  select timezone into hub_timezone from public.workforce_settings where workspace_id = target_workspace_id;
  local_work_date := (now() at time zone coalesce(hub_timezone, 'UTC'))::date;

  if (settings.capture_location or settings.enforce_geofence) and (event_latitude is null or event_longitude is null) then
    raise exception 'Location is required for this action.';
  end if;
  if settings.require_selfie and requested_action = 'clock_in' and nullif(event_selfie_path, '') is null then
    raise exception 'A selfie is required to clock in.';
  end if;
  if settings.enforce_geofence then
    distance_meters := 6371000 * acos(least(1, greatest(-1,
      cos(radians(settings.office_latitude)) * cos(radians(event_latitude)) * cos(radians(event_longitude) - radians(settings.office_longitude)) +
      sin(radians(settings.office_latitude)) * sin(radians(event_latitude))
    )));
    if distance_meters > settings.geofence_radius_meters then raise exception 'You are outside the permitted clock-in area.'; end if;
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
  if settings.capture_ip then
    begin captured_ip := split_part(coalesce(request_headers->>'x-forwarded-for', request_headers->>'x-real-ip'), ',', 1)::inet; exception when others then captured_ip := null; end;
  end if;
  insert into public.time_events (workspace_id, employee_profile_id, time_entry_id, event_type, latitude, longitude, map_url, ip_address, device_information, selfie_path, distance_from_office_meters)
  values (target_workspace_id, employee.id, active_entry.id, event_kind,
    case when settings.capture_location or settings.enforce_geofence then event_latitude end,
    case when settings.capture_location or settings.enforce_geofence then event_longitude end,
    case when event_latitude is not null and event_longitude is not null then 'https://www.openstreetmap.org/?mlat=' || event_latitude || '&mlon=' || event_longitude end,
    captured_ip, case when settings.capture_device then left(event_device_information, 1000) end,
    case when settings.require_selfie and requested_action = 'clock_in' then event_selfie_path end, distance_meters);
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
  insert into public.payroll_items (workspace_id, payroll_period_id, employee_profile_id, regular_hours, overtime_hours, gross_pay, net_pay, calculation_details)
  select period.workspace_id, period.id, ep.id,
    totals.regular_hours, totals.overtime_hours,
    round(case s.compensation_type
      when 'hourly' then totals.regular_hours * amount.rate + totals.overtime_hours * amount.rate * 1.5
      when 'daily' then totals.days_worked * amount.rate
      when 'weekly' then amount.rate * ((period.period_end - period.period_start + 1)::numeric / 7)
      when 'semimonthly' then amount.rate
      when 'monthly' then amount.rate
      when 'annual' then amount.rate * ((period.period_end - period.period_start + 1)::numeric / 365.25)
      else 0 end, 2),
    round(case s.compensation_type
      when 'hourly' then totals.regular_hours * amount.rate + totals.overtime_hours * amount.rate * 1.5
      when 'daily' then totals.days_worked * amount.rate
      when 'weekly' then amount.rate * ((period.period_end - period.period_start + 1)::numeric / 7)
      when 'semimonthly' then amount.rate
      when 'monthly' then amount.rate
      when 'annual' then amount.rate * ((period.period_end - period.period_start + 1)::numeric / 365.25)
      else 0 end, 2),
    jsonb_build_object('compensation_type', s.compensation_type, 'rate', amount.rate, 'days_worked', totals.days_worked)
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
  where ep.workspace_id = period.workspace_id and ep.employment_status = 'active'
  on conflict (payroll_period_id, employee_profile_id) do update set
    regular_hours = excluded.regular_hours, overtime_hours = excluded.overtime_hours,
    gross_pay = excluded.gross_pay, net_pay = excluded.net_pay,
    calculation_details = excluded.calculation_details, updated_at = now();
  get diagnostics generated_count = row_count;
  update public.payroll_periods set status = 'calculated', updated_at = now() where id = period.id;
  return generated_count;
end;
$$;

revoke all on function public.update_own_employee_profile(uuid, text, text, text, text, date, text, text) from public, anon;
grant execute on function public.update_own_employee_profile(uuid, text, text, text, text, date, text, text) to authenticated;
revoke all on function public.upsert_employee_sensitive_payroll(uuid, text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.upsert_employee_sensitive_payroll(uuid, text, text, text, text, jsonb, jsonb) to authenticated;
revoke all on function public.get_employee_sensitive_payroll(uuid) from public, anon;
grant execute on function public.get_employee_sensitive_payroll(uuid) to authenticated;
revoke all on function public.record_time_event(uuid, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.record_time_event(uuid, text, double precision, double precision, text, text) to authenticated;
revoke all on function public.generate_payroll(uuid) from public, anon;
grant execute on function public.generate_payroll(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('employee-documents', 'employee-documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Workforce members read employee files" on storage.objects;
create policy "Workforce members read employee files" on storage.objects for select to authenticated using (
  bucket_id = 'employee-documents' and (
    (storage.foldername(name))[2] = auth.uid()::text or
    public.is_workforce_admin(((storage.foldername(name))[1])::uuid)
  )
);
drop policy if exists "Workforce members upload employee files" on storage.objects;
create policy "Workforce members upload employee files" on storage.objects for insert to authenticated with check (
  bucket_id = 'employee-documents' and public.is_workforce_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] = auth.uid()::text or public.is_workforce_admin(((storage.foldername(name))[1])::uuid))
);
drop policy if exists "Workforce admins delete employee files" on storage.objects;
create policy "Workforce admins delete employee files" on storage.objects for delete to authenticated using (
  bucket_id = 'employee-documents' and public.is_workforce_admin(((storage.foldername(name))[1])::uuid)
);

do $$
declare table_name text;
begin
  foreach table_name in array array['time_entries', 'time_events', 'leave_requests', 'payroll_periods', 'payroll_items', 'employee_profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
