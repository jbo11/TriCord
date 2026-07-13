-- Owner-name Room email aliases for room.tricord.cc.
-- Stores only the local part, for example sheenabo-sales.

create or replace function public.room_email_owner_part(owner_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(regexp_replace(lower(coalesce(owner_name, 'owner')), '[^a-z0-9]+', '', 'g'), ''),
    'owner'
  );
$$;

create or replace function public.room_email_room_part(room_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(coalesce(room_name, 'room')), '[^a-z0-9]+', '-', 'g')), ''),
    'room'
  );
$$;

create or replace function public.build_room_email_alias(room_name text, workspace_id uuid, current_space_id uuid default null)
returns text
language plpgsql
volatile
as $$
declare
  owner_name text;
  owner_part text;
  room_part text;
  base text;
  suffix text;
  candidate text;
  attempts integer := 0;
begin
  select coalesce(nullif(trim(u.full_name), ''), nullif(trim(u.display_name), ''), split_part(u.email, '@', 1), 'owner')
    into owner_name
  from public.workspaces w
  join public.users u on u.id = w.owner_id
  where w.id = workspace_id;

  owner_part := public.room_email_owner_part(owner_name);
  room_part := public.room_email_room_part(room_name);
  base := left(owner_part || '-' || room_part, 63);
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

create or replace function public.ensure_room_email_alias()
returns trigger
language plpgsql
as $$
begin
  if new.email_alias is null or trim(new.email_alias) = '' then
    new.email_alias := public.build_room_email_alias(new.name, new.workspace_id, new.id);
  else
    new.email_alias := public.room_email_room_part(new.email_alias);
  end if;
  return new;
end;
$$;

-- Regenerate existing Room aliases so they follow owner-name-room-name.
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
before insert or update of email_alias on public.spaces
for each row execute function public.ensure_room_email_alias();

comment on function public.build_room_email_alias(text, uuid, uuid) is 'Builds a globally unique owner-name plus Room-name email alias local part such as sheenabo-sales for room.tricord.cc.';
comment on column public.spaces.email_alias is 'Unique local part used for Room email forwarding addresses at room.tricord.cc, usually ownername-roomname.';

notify pgrst, 'reload schema';
