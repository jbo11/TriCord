create or replace function public.bump_post_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts as target_post
  set last_activity_at = now()
  where target_post.id = new.post_id;
  return new;
end;
$$;
