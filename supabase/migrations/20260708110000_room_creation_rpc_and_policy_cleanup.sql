-- Centralize room creation behind a secure RPC so UI room creation does not
-- depend on overlapping historical insert policies.

drop policy if exists "Members create rooms" on public.spaces;
drop policy if exists "Authorized users create spaces" on public.spaces;

create policy "Authorized users create spaces"
on public.spaces for insert
with check (
  created_by = auth.uid()
  and (
    public.has_workspace_capability(workspace_id, 'manage_rooms')
    or public.has_workspace_role(workspace_id, array['member']::public.workspace_role[])
  )
);

create or replace function public.create_room(
  target_workspace_id uuid,
  room_name text,
  room_slug text,
  room_access public.space_access default 'public'
)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  created_room public.spaces%rowtype;
  cleaned_name text := nullif(trim(room_name), '');
  cleaned_slug text := nullif(trim(room_slug), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a room.';
  end if;

  if cleaned_name is null then
    raise exception 'Room name is required.';
  end if;

  if cleaned_slug is null then
    raise exception 'Room slug is required.';
  end if;

  if not (
    public.has_workspace_capability(target_workspace_id, 'manage_rooms')
    or public.has_workspace_role(target_workspace_id, array['member']::public.workspace_role[])
  ) then
    raise exception 'Room creation access required.';
  end if;

  insert into public.spaces (workspace_id, name, slug, access, created_by)
  values (target_workspace_id, cleaned_name, cleaned_slug, room_access, auth.uid())
  returning * into created_room;

  return created_room;
end;
$$;

revoke all on function public.create_room(uuid, text, text, public.space_access) from public, anon;
grant execute on function public.create_room(uuid, text, text, public.space_access) to authenticated;

notify pgrst, 'reload schema';
