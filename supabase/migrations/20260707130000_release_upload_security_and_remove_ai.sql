-- Release hardening: remove active AI schema, enforce 20 MB direct uploads,
-- add attachment safeguards, and improve query/index coverage.

-- Disable active AI tables for this release. AI can be reintroduced later via a new migration.
drop table if exists public.ai_messages cascade;
drop table if exists public.ai_agents cascade;
alter table if exists public.workspaces drop column if exists ai_monthly_quota;
do $$
begin
  drop type if exists public.agent_provider;
exception
  when dependent_objects_still_exist then null;
end $$;

-- Direct Supabase uploads are capped at 20 MB. Larger files must use an external cloud provider link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('workspace-files', 'workspace-files', false, 20971520, null),
  ('employee-documents', 'employee-documents', false, 20971520, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.attachments
  add column if not exists external_provider text generated always as (metadata->>'provider') stored,
  add column if not exists external_url text generated always as (metadata->>'external_url') stored;

alter table public.attachments drop constraint if exists attachments_file_size_release_check;
alter table public.attachments add constraint attachments_file_size_release_check check (
  (bucket = 'workspace-files' and byte_size between 1 and 20971520)
  or (bucket = 'external-cloud' and byte_size between 20971521 and 524288000 and external_url ~ '^https://')
  or (bucket not in ('workspace-files', 'external-cloud') and byte_size > 0)
);

alter table public.attachments drop constraint if exists attachments_blocked_extensions_check;
alter table public.attachments add constraint attachments_blocked_extensions_check check (
  lower(filename) !~ '\.(ade|adp|apk|app|bat|bin|cmd|com|cpl|dll|dmg|exe|gadget|hta|ins|iso|jar|js|jse|lib|lnk|mde|msc|msi|msp|mst|osx|pif|ps1|scr|sh|sys|vb|vbe|vbs|vxd|ws|wsc|wsf|wsh)$'
);

-- Keep external attachment rows readable through existing attachment RLS; no storage.objects row is created.
drop policy if exists "Users upload accessible external attachments" on public.attachments;
create policy "Users upload accessible external attachments"
on public.attachments for insert
to authenticated
with check (
  bucket = 'external-cloud'
  and uploaded_by = auth.uid()
  and byte_size between 20971521 and 524288000
  and external_url ~ '^https://'
  and exists (
    select 1 from public.posts p
    where p.id = attachments.post_id and public.can_access_space(p.space_id)
  )
);

-- Practical query/index limits for feed, attachments, membership, workforce, and billing paths.
create index if not exists posts_workspace_state_activity_idx on public.posts (workspace_id, state, last_activity_at desc);
create index if not exists posts_space_activity_idx on public.posts (space_id, last_activity_at desc);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at);
create index if not exists attachments_post_created_idx on public.attachments (post_id, created_at desc);
create index if not exists attachments_comment_created_idx on public.attachments (comment_id, created_at desc);
create index if not exists attachments_workspace_uploaded_idx on public.attachments (workspace_id, uploaded_by, created_at desc);
create index if not exists memberships_user_workspace_idx on public.memberships (user_id, workspace_id);
create index if not exists memberships_workspace_role_idx on public.memberships (workspace_id, role);
create index if not exists tasks_workspace_status_due_idx on public.tasks (workspace_id, status, due_at);
create index if not exists knowledge_articles_workspace_category_idx on public.knowledge_articles (workspace_id, category, updated_at desc);
create index if not exists time_entries_workspace_employee_date_idx on public.time_entries (workspace_id, employee_profile_id, work_date desc);
create index if not exists time_events_workspace_entry_idx on public.time_events (workspace_id, time_entry_id, occurred_at desc);
create index if not exists subscriptions_workspace_status_idx on public.subscriptions (workspace_id, status);

comment on table public.attachments is 'Attachment metadata. Direct Supabase Storage files are limited to 20 MB. Larger files must be represented by secure external cloud links in metadata.external_url.';
