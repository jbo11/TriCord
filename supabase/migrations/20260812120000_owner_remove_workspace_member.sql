create or replace function public.remove_workspace_member(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.memberships%rowtype;
begin
  select * into target_membership
  from public.memberships
  where id = target_membership_id;

  if target_membership.id is null then
    raise exception 'Membership not found.';
  end if;

  if not public.has_workspace_role(target_membership.workspace_id, array['owner']::public.workspace_role[]) then
    raise exception 'Only the Hub Owner can remove people.';
  end if;

  if target_membership.role = 'owner' then
    raise exception 'The Hub Owner cannot be removed here.';
  end if;

  delete from public.space_memberships sm
  using public.spaces s
  where sm.space_id = s.id
    and s.workspace_id = target_membership.workspace_id
    and sm.user_id = target_membership.user_id;

  delete from public.workspace_capabilities
  where workspace_id = target_membership.workspace_id
    and user_id = target_membership.user_id;

  delete from public.memberships
  where id = target_membership.id;
end;
$$;
