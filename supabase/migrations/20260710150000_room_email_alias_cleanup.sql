-- Clean Room email aliases for Resend receiving at room.tricord.cc.
-- Stores only the unique local part in public.spaces.email_alias; the app appends the receiving domain.

create or replace function public.slugify_room_email_name(room_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(coalesce(room_name, 'room')), '[^a-z0-9]+', '-', 'g')), ''),
    'room'
  );
$$;

create or replace function public.random_room_email_suffix(suffix_length integer default 5)
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  output text := '';
  index integer;
begin
  for index in 1..greatest(4, least(coalesce(suffix_length, 5), 6)) loop
    output := output || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
  end loop;
  return output;
end;
$$;

create or replace function public.build_room_email_alias(room_name text)
returns text
language plpgsql
volatile
as $$
declare
  base text := public.slugify_room_email_name(room_name);
  suffix text;
  candidate text;
  attempts integer := 0;
begin
  base := left(base, 57);
  loop
    attempts := attempts + 1;
    suffix := public.random_room_email_suffix(5);
    candidate := left(base, 63 - length(suffix) - 1) || '-' || suffix;

    exit when not exists (
      select 1
      from public.spaces
      where email_alias = candidate
    );

    if attempts >= 50 then
      suffix := public.random_room_email_suffix(6);
      candidate := left(base, 63 - length(suffix) - 1) || '-' || suffix;
      exit when not exists (
        select 1
        from public.spaces
        where email_alias = candidate
      );
    end if;

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
    new.email_alias := public.build_room_email_alias(new.name);
  else
    new.email_alias := public.slugify_room_email_name(new.email_alias);
  end if;
  return new;
end;
$$;

-- Regenerate old UUID/hash-style aliases into readable room-name aliases.
do $$
declare
  room_record record;
  next_alias text;
begin
  for room_record in
    select id, name, email_alias
    from public.spaces
    where email_alias is null
      or trim(email_alias) = ''
      or email_alias ~ '-[0-9a-f]{8,}$'
  loop
    next_alias := public.build_room_email_alias(room_record.name);
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

comment on function public.build_room_email_alias(text) is 'Builds a globally unique, human-readable Room email alias local part such as sales-a3f7k for room.tricord.cc.';
comment on column public.spaces.email_alias is 'Unique local part used for Room email forwarding addresses at room.tricord.cc.';

notify pgrst, 'reload schema';
