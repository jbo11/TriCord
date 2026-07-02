-- Configurable schedules, holidays, and country-aware payroll rules.

alter table public.timekeeping_settings
  add column if not exists workday_start time not null default '09:00',
  add column if not exists workday_end time not null default '17:00',
  add column if not exists workdays smallint[] not null default array[1,2,3,4,5]::smallint[];

create table if not exists public.workforce_holidays (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  country_code text,
  paid boolean not null default true,
  unique (workspace_id, holiday_date)
);

create table if not exists public.payroll_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  rule_kind text not null check (rule_kind in ('earning', 'deduction')),
  calculation_type text not null check (calculation_type in ('fixed', 'percentage')),
  value numeric(12,4) not null check (value >= 0),
  country_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workforce_holidays_workspace_date_idx on public.workforce_holidays (workspace_id, holiday_date);
create index if not exists payroll_rules_workspace_active_idx on public.payroll_rules (workspace_id, active);

alter table public.workforce_holidays enable row level security;
alter table public.payroll_rules enable row level security;

drop policy if exists "Workforce members read holidays" on public.workforce_holidays;
create policy "Workforce members read holidays" on public.workforce_holidays for select using (public.is_workforce_member(workspace_id));
drop policy if exists "Admins manage holidays" on public.workforce_holidays;
create policy "Admins manage holidays" on public.workforce_holidays for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

drop policy if exists "Workforce members read payroll rules" on public.payroll_rules;
create policy "Workforce members read payroll rules" on public.payroll_rules for select using (public.is_workforce_member(workspace_id));
drop policy if exists "Admins manage payroll rules" on public.payroll_rules;
create policy "Admins manage payroll rules" on public.payroll_rules for all
using (public.is_workforce_admin(workspace_id)) with check (public.is_workforce_admin(workspace_id));

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
      coalesce(sum(case when pr.rule_kind = 'earning' then case pr.calculation_type when 'percentage' then gross.base_gross * pr.value / 100 else pr.value end else 0 end), 0) as earnings,
      coalesce(sum(case when pr.rule_kind = 'deduction' then case pr.calculation_type when 'percentage' then gross.base_gross * pr.value / 100 else pr.value end else 0 end), 0) as deductions
    from public.payroll_rules pr
    where pr.workspace_id = period.workspace_id and pr.active
      and (pr.country_code is null or pr.country_code = (select country_code from public.workforce_settings where workspace_id = period.workspace_id))
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

revoke all on function public.generate_payroll(uuid) from public, anon;
grant execute on function public.generate_payroll(uuid) to authenticated;

do $$
declare target_table text;
begin
  foreach target_table in array array['workforce_holidays', 'payroll_rules'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target_table) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
