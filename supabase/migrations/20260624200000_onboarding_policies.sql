drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
on public.users
for insert
with check (id = auth.uid());

drop policy if exists "Workspace peers can read profiles" on public.users;
create policy "Workspace peers can read profiles"
on public.users
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.memberships viewer
    join public.memberships peer
      on peer.workspace_id = viewer.workspace_id
    where viewer.user_id = auth.uid()
      and peer.user_id = public.users.id
  )
);

drop policy if exists "Authenticated users create owned workspaces" on public.workspaces;
create policy "Authenticated users create owned workspaces"
on public.workspaces
for insert
with check (owner_id = auth.uid());

drop policy if exists "Owners create their initial membership" on public.memberships;
create policy "Owners create their initial membership"
on public.memberships
for insert
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "Admins create spaces" on public.spaces;
create policy "Admins create spaces"
on public.spaces
for insert
with check (
  created_by = auth.uid()
  and public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])
);

drop policy if exists "Admins update spaces" on public.spaces;
create policy "Admins update spaces"
on public.spaces
for update
using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
