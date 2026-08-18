create or replace function public.remove_workspace_member(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.memberships%rowtype;
  remaining_memberships integer;
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

  if to_regclass('public.employee_profiles') is not null then
    execute 'delete from public.employee_profiles where workspace_id = $1 and user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  if to_regclass('public.workforce_permissions') is not null then
    execute 'delete from public.workforce_permissions where workspace_id = $1 and user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  if to_regclass('public.user_email_accounts') is not null then
    execute 'delete from public.user_email_accounts where workspace_id = $1 and user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  if to_regclass('public.email_oauth_states') is not null then
    execute 'delete from public.email_oauth_states where workspace_id = $1 and user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  if to_regclass('public.notifications') is not null then
    execute 'delete from public.notifications where workspace_id = $1 and user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  if to_regclass('public.workspace_notifications') is not null then
    execute 'delete from public.workspace_notifications where workspace_id = $1 and user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  if to_regclass('public.space_memberships') is not null and to_regclass('public.spaces') is not null then
    execute 'delete from public.space_memberships sm using public.spaces s where sm.space_id = s.id and s.workspace_id = $1 and sm.user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  if to_regclass('public.workspace_capabilities') is not null then
    execute 'delete from public.workspace_capabilities where workspace_id = $1 and user_id = $2'
    using target_membership.workspace_id, target_membership.user_id;
  end if;

  delete from public.memberships
  where id = target_membership.id;

  select count(*) into remaining_memberships
  from public.memberships
  where user_id = target_membership.user_id;

  if remaining_memberships = 0 then
    if to_regclass('public.user_private_profiles') is not null then
      execute 'delete from public.user_private_profiles where user_id = $1'
      using target_membership.user_id;
    end if;

    if to_regclass('public.email_oauth_states') is not null then
      execute 'delete from public.email_oauth_states where user_id = $1'
      using target_membership.user_id;
    end if;

    if to_regclass('public.user_email_accounts') is not null then
      execute 'delete from public.user_email_accounts where user_id = $1'
      using target_membership.user_id;
    end if;

    begin
      delete from public.users
      where id = target_membership.user_id;
    exception
      when foreign_key_violation then
        update public.users
        set
          email = 'removed-' || target_membership.user_id::text || '@removed.tricord.local',
          display_name = 'Removed user',
          full_name = 'Removed user',
          nickname = 'Removed user',
          avatar_url = null,
          timezone = 'UTC',
          updated_at = now()
        where id = target_membership.user_id;
    end;
  end if;
end;
$$;
