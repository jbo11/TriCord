-- Room-name email aliases for room.tricord.cc and HR action policies.
-- Uses the plain slugified Room name when globally available, e.g. sales@room.tricord.cc.
-- If another Room already owns that alias, a short suffix is appended, e.g. sales-a3f7@room.tricord.cc.

create or replace function public.build_room_email_alias(room_name text, workspace_id uuid default null, current_space_id uuid default null)
returns text
language plpgsql
volatile
as $$
declare
  base text := left(public.room_email_room_part(room_name), 63);
  suffix text;
  candidate text;
  attempts integer := 0;
begin
  candidate := base;

  if not exists (
    select 1
    from public.spaces
    where email_alias = candidate
      and (current_space_id is null or id <> current_space_id)
  ) then
    return candidate;
  end if;

  loop
    attempts := attempts + 1;
    suffix := public.random_room_email_suffix(4);
    candidate := left(base, 63 - length(suffix) - 1) || '-' || suffix;

    exit when not exists (
      select 1
      from public.spaces
      where email_alias = candidate
        and (current_space_id is null or id <> current_space_id)
    );

    if attempts >= 100 then
      raise exception 'Could not generate a unique Room email alias';
    end if;
  end loop;

  return candidate;
end;
$$;

create or replace function public.build_room_email_alias(room_name text)
returns text
language sql
volatile
as $$
  select public.build_room_email_alias(room_name, null::uuid, null::uuid);
$$;

create or replace function public.ensure_room_email_alias()
returns trigger
language plpgsql
as $$
begin
  if new.email_alias is null or trim(new.email_alias) = '' or (tg_op = 'UPDATE' and new.name is distinct from old.name) then
    new.email_alias := public.build_room_email_alias(new.name, new.workspace_id, new.id);
  else
    new.email_alias := public.room_email_room_part(split_part(new.email_alias, '@', 1));
  end if;
  return new;
end;
$$;

do $$
declare
  room_record record;
  next_alias text;
begin
  for room_record in
    select s.id, s.workspace_id, s.name
    from public.spaces s
    order by s.created_at, s.id
  loop
    next_alias := public.build_room_email_alias(room_record.name, room_record.workspace_id, room_record.id);
    update public.spaces
    set email_alias = next_alias,
        updated_at = now()
    where id = room_record.id;
  end loop;
end $$;

drop trigger if exists ensure_room_email_alias_before_write on public.spaces;
create trigger ensure_room_email_alias_before_write
before insert or update of email_alias, name on public.spaces
for each row execute function public.ensure_room_email_alias();

comment on function public.build_room_email_alias(text, uuid, uuid) is 'Builds a globally unique Room-name email alias local part such as sales, or sales-a3f7 on collision, for room.tricord.cc.';
comment on column public.spaces.email_alias is 'Unique local part used for Room email forwarding addresses at room.tricord.cc, usually the slugified Room name.';

drop policy if exists "Authorized users update employee documents" on public.employee_documents;
create policy "Authorized users update employee documents"
on public.employee_documents for update
using (public.can_manage_hr(workspace_id))
with check (public.can_manage_hr(workspace_id));

drop policy if exists "Authorized users approve leave requests" on public.leave_requests;
create policy "Authorized users update leave requests"
on public.leave_requests for update
using (
  public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
  or (
    status = 'pending'
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
)
with check (
  public.can_manage_hr(workspace_id)
  or public.has_workspace_capability(workspace_id, 'approve_leave')
  or (
    status in ('pending', 'canceled')
    and reviewed_by is null
    and exists (select 1 from public.employee_profiles ep where ep.id = employee_profile_id and ep.user_id = auth.uid())
  )
);

notify pgrst, 'reload schema';
