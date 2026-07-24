alter table public.tasks
  add column if not exists reminder_at timestamptz,
  add column if not exists recurrence_rule text not null default 'none',
  add column if not exists recurrence_custom text;

do $$
begin
  alter table public.tasks
    add constraint tasks_recurrence_rule_check
    check (recurrence_rule in ('none', 'daily', 'weekly', 'monthly', 'custom'));
exception
  when duplicate_object then null;
end $$;

create index if not exists tasks_assignee_reminder_idx
  on public.tasks (workspace_id, assignee_id, reminder_at)
  where reminder_at is not null and archived_at is null;

create index if not exists tasks_due_idx
  on public.tasks (workspace_id, due_at)
  where due_at is not null and archived_at is null;

alter table public.time_entries
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references public.users(id) on delete set null,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text,
  add column if not exists dispute_status text not null default 'none',
  add column if not exists dispute_reviewed_at timestamptz,
  add column if not exists dispute_reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists dispute_resolution_note text;

do $$
begin
  alter table public.time_entries
    add constraint time_entries_dispute_status_check
    check (dispute_status in ('none', 'pending', 'approved', 'declined'));
exception
  when duplicate_object then null;
end $$;

create index if not exists time_entries_confirmation_idx
  on public.time_entries (workspace_id, confirmed_at);

create index if not exists time_entries_dispute_idx
  on public.time_entries (workspace_id, dispute_status)
  where dispute_status <> 'none';

create or replace function public.confirm_time_entry(target_entry_id uuid)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  entry_record public.time_entries;
  employee_record public.employee_profiles;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into entry_record
  from public.time_entries
  where id = target_entry_id;

  if entry_record.id is null then
    raise exception 'Attendance record not found';
  end if;

  select * into employee_record
  from public.employee_profiles
  where id = entry_record.employee_profile_id;

  if employee_record.user_id <> current_user_id
    and not public.can_manage_time_entries(entry_record.workspace_id) then
    raise exception 'Not authorized to confirm this attendance record';
  end if;

  update public.time_entries
  set confirmed_at = now(),
      confirmed_by = current_user_id,
      dispute_status = case when dispute_status = 'pending' then dispute_status else 'none' end,
      updated_at = now()
  where id = target_entry_id
  returning * into entry_record;

  return entry_record;
end;
$$;

create or replace function public.confirm_time_entries(target_workspace_id uuid, target_employee_profile_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  confirmed_count integer := 0;
  own_employee_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into own_employee_id
  from public.employee_profiles
  where workspace_id = target_workspace_id
    and user_id = current_user_id
  limit 1;

  if public.can_manage_time_entries(target_workspace_id) then
    update public.time_entries
    set confirmed_at = now(),
        confirmed_by = current_user_id,
        updated_at = now()
    where workspace_id = target_workspace_id
      and clock_out is not null
      and confirmed_at is null
      and dispute_status <> 'pending'
      and (target_employee_profile_id is null or employee_profile_id = target_employee_profile_id);
  else
    update public.time_entries
    set confirmed_at = now(),
        confirmed_by = current_user_id,
        updated_at = now()
    where workspace_id = target_workspace_id
      and employee_profile_id = own_employee_id
      and clock_out is not null
      and confirmed_at is null
      and dispute_status <> 'pending';
  end if;

  get diagnostics confirmed_count = row_count;
  return confirmed_count;
end;
$$;

create or replace function public.dispute_time_entry(target_entry_id uuid, reason text)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  entry_record public.time_entries;
  employee_record public.employee_profiles;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(coalesce(reason, ''))) < 3 then
    raise exception 'Add a short explanation for the dispute';
  end if;

  select * into entry_record
  from public.time_entries
  where id = target_entry_id;

  if entry_record.id is null then
    raise exception 'Attendance record not found';
  end if;

  select * into employee_record
  from public.employee_profiles
  where id = entry_record.employee_profile_id;

  if employee_record.user_id <> current_user_id then
    raise exception 'Only the employee can dispute their own attendance record';
  end if;

  update public.time_entries
  set disputed_at = now(),
      dispute_reason = trim(reason),
      dispute_status = 'pending',
      dispute_reviewed_at = null,
      dispute_reviewed_by = null,
      dispute_resolution_note = null,
      confirmed_at = null,
      confirmed_by = null,
      updated_at = now()
  where id = target_entry_id
  returning * into entry_record;

  return entry_record;
end;
$$;

create or replace function public.review_time_entry_dispute(target_entry_id uuid, approved boolean, note text default null)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  entry_record public.time_entries;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into entry_record
  from public.time_entries
  where id = target_entry_id;

  if entry_record.id is null then
    raise exception 'Attendance record not found';
  end if;

  if not public.can_manage_time_entries(entry_record.workspace_id) then
    raise exception 'Not authorized to review attendance disputes';
  end if;

  update public.time_entries
  set dispute_status = case when approved then 'approved' else 'declined' end,
      dispute_reviewed_at = now(),
      dispute_reviewed_by = current_user_id,
      dispute_resolution_note = nullif(trim(coalesce(note, '')), ''),
      updated_at = now()
  where id = target_entry_id
  returning * into entry_record;

  return entry_record;
end;
$$;

grant execute on function public.confirm_time_entry(uuid) to authenticated;
grant execute on function public.confirm_time_entries(uuid, uuid) to authenticated;
grant execute on function public.dispute_time_entry(uuid, text) to authenticated;
grant execute on function public.review_time_entry_dispute(uuid, boolean, text) to authenticated;
