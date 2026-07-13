-- Hub-name plus Room-name email aliases for room.tricord.cc.
-- Example: CarePro VA + Sales -> careprova-sales@room.tricord.cc.

create or replace function public.room_email_hub_part(hub_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(regexp_replace(lower(coalesce(hub_name, 'hub')), '[^a-z0-9]+', '', 'g'), ''),
    'hub'
  );
$$;

create or replace function public.build_room_email_alias(room_name text, workspace_id uuid default null, current_space_id uuid default null)
returns text
language plpgsql
volatile
as $$
declare
  hub_name text;
  hub_part text;
  room_part text := public.room_email_room_part(room_name);
  base text;
  suffix text;
  candidate text;
  attempts integer := 0;
begin
  if workspace_id is not null then
    select name into hub_name from public.workspaces where id = workspace_id;
  end if;

  hub_part := public.room_email_hub_part(hub_name);
  base := case when workspace_id is null then room_part else left(hub_part || '-' || room_part, 63) end;
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
  if new.email_alias is null or trim(new.email_alias) = '' or (tg_op = 'UPDATE' and (new.name is distinct from old.name or new.workspace_id is distinct from old.workspace_id)) then
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
before insert or update of email_alias, name, workspace_id on public.spaces
for each row execute function public.ensure_room_email_alias();

comment on function public.build_room_email_alias(text, uuid, uuid) is 'Builds a globally unique Hub-name plus Room-name email alias local part such as careprova-sales for room.tricord.cc.';
comment on column public.spaces.email_alias is 'Unique local part used for Room email forwarding addresses at room.tricord.cc, usually hubname-roomname.';

notify pgrst, 'reload schema';
