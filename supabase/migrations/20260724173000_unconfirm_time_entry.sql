create or replace function public.unconfirm_time_entry(target_entry_id uuid)
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
    raise exception 'Not authorized to unconfirm this attendance record';
  end if;

  update public.time_entries
  set confirmed_at = null,
      confirmed_by = null,
      updated_at = now()
  where id = target_entry_id
  returning * into entry_record;

  return entry_record;
end;
$$;

grant execute on function public.unconfirm_time_entry(uuid) to authenticated;
