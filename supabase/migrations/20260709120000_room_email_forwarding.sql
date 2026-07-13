-- Room email forwarding foundation.
-- Each Room gets a stable alias that can be used by an inbound email provider
-- to route forwarded emails into TriCord discussions.

alter table public.spaces
  add column if not exists email_alias text,
  add column if not exists email_forwarding_enabled boolean not null default true;

create or replace function public.build_room_email_alias(room_slug text, room_id uuid)
returns text
language sql
immutable
as $$
  select left(
    trim(both '-' from regexp_replace(lower(coalesce(nullif(room_slug, ''), 'room')), '[^a-z0-9]+', '-', 'g'))
    || '-' || substring(replace(room_id::text, '-', '') from 1 for 8),
    63
  );
$$;

update public.spaces
set email_alias = public.build_room_email_alias(slug, id)
where email_alias is null or trim(email_alias) = '';

alter table public.spaces
  alter column email_alias set not null;

create unique index if not exists spaces_email_alias_idx
on public.spaces (email_alias);

create or replace function public.ensure_room_email_alias()
returns trigger
language plpgsql
as $$
begin
  if new.email_alias is null or trim(new.email_alias) = '' then
    new.email_alias := public.build_room_email_alias(new.slug, new.id);
  else
    new.email_alias := trim(lower(new.email_alias));
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_room_email_alias_before_write on public.spaces;
create trigger ensure_room_email_alias_before_write
before insert or update of email_alias, slug on public.spaces
for each row execute function public.ensure_room_email_alias();

comment on column public.spaces.email_alias is 'Unique local part used for Room email forwarding addresses.';
comment on column public.spaces.email_forwarding_enabled is 'Controls whether forwarded inbound emails may be converted into Room posts.';

notify pgrst, 'reload schema';
