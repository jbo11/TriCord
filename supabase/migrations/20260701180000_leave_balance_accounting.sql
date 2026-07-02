-- Keep leave balances synchronized with approved leave requests.

create or replace function public.sync_approved_leave_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_year integer;
begin
  if tg_op = 'UPDATE' and old.status = 'approved' then
    update public.leave_balances
    set used = greatest(0, used - old.days)
    where employee_profile_id = old.employee_profile_id
      and leave_type_id = old.leave_type_id
      and year = extract(year from old.start_date)::integer;
  end if;

  if new.status = 'approved' then
    target_year := extract(year from new.start_date)::integer;
    insert into public.leave_balances (workspace_id, employee_profile_id, leave_type_id, year, allocated, used)
    select new.workspace_id, new.employee_profile_id, new.leave_type_id, target_year,
      coalesce(lt.annual_allowance, 0), new.days
    from public.leave_types lt where lt.id = new.leave_type_id
    on conflict (employee_profile_id, leave_type_id, year) do update
    set used = public.leave_balances.used + excluded.used;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_approved_leave_balance on public.leave_requests;
create trigger sync_approved_leave_balance
after insert or update of status, days, start_date, leave_type_id on public.leave_requests
for each row execute function public.sync_approved_leave_balance();
