-- TriCord single-subscription trial model and OAuth email conversation foundation.
-- This migration keeps legacy plan columns intact for backwards compatibility while
-- adding the product model moving forward: 30-day trial -> active subscription -> expired/read-only.

alter type public.plan_tier add value if not exists 'tricord';
comment on type public.plan_tier is 'Legacy billing enum retained for live-database compatibility. New customer-facing billing uses one TriCord subscription after a 30-day trial.';

alter table public.workspaces
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_cancelled_at timestamptz;

alter table public.workspaces
  drop constraint if exists workspaces_subscription_status_check;
alter table public.workspaces
  add constraint workspaces_subscription_status_check
  check (subscription_status in ('trial', 'active', 'expired', 'cancelled'));

update public.workspaces
set trial_started_at = coalesce(trial_started_at, created_at, now()),
    trial_ends_at = coalesce(trial_ends_at, coalesce(created_at, now()) + interval '30 days'),
    subscription_status = case
      when coalesce(plan, 'free') in ('plus', 'pro', 'business', 'enterprise') then 'active'
      when coalesce(trial_ends_at, coalesce(created_at, now()) + interval '30 days') < now() then 'expired'
      else 'trial'
    end,
    subscription_started_at = case
      when coalesce(plan, 'free') in ('plus', 'pro', 'business', 'enterprise') then coalesce(subscription_started_at, created_at, now())
      else subscription_started_at
    end
where trial_started_at is null
   or trial_ends_at is null
   or subscription_status is null
   or subscription_status = 'trial';

create table if not exists public.workspace_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  email_sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workspace_notifications_user_idx on public.workspace_notifications (user_id, read_at, created_at desc);
create index if not exists workspace_notifications_workspace_idx on public.workspace_notifications (workspace_id, notification_type, created_at desc);

create table if not exists public.workspace_subscription_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, event_type)
);

create table if not exists public.workspace_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'complete', 'failed')),
  storage_bucket text,
  storage_path text,
  signed_url_expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists workspace_exports_workspace_idx on public.workspace_exports (workspace_id, created_at desc);

alter table public.workspace_notifications enable row level security;
alter table public.workspace_exports enable row level security;
alter table public.workspace_subscription_events enable row level security;

drop policy if exists "Users read own workspace notifications" on public.workspace_notifications;
create policy "Users read own workspace notifications"
on public.workspace_notifications for select
using (user_id = auth.uid());

drop policy if exists "Users update own workspace notifications" on public.workspace_notifications;
create policy "Users update own workspace notifications"
on public.workspace_notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Owners read workspace exports" on public.workspace_exports;
create policy "Owners read workspace exports"
on public.workspace_exports for select
using (exists (
  select 1 from public.memberships m
  where m.workspace_id = workspace_exports.workspace_id
    and m.user_id = auth.uid()
    and m.role = 'owner'
));

drop policy if exists "Owners create workspace exports" on public.workspace_exports;
create policy "Owners create workspace exports"
on public.workspace_exports for insert
with check (exists (
  select 1 from public.memberships m
  where m.workspace_id = workspace_exports.workspace_id
    and m.user_id = auth.uid()
    and m.role = 'owner'
));

create or replace function public.is_workspace_read_only(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and (
        w.subscription_status in ('expired', 'cancelled')
        or (w.subscription_status = 'trial' and coalesce(w.trial_ends_at, now()) < now())
      )
  );
$$;

create or replace function public.mark_expired_workspace_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
  workspace_record record;
begin
  for workspace_record in
    update public.workspaces
    set subscription_status = 'expired', updated_at = now()
    where subscription_status = 'trial'
      and trial_ends_at < now()
    returning id, owner_id, name
  loop
    expired_count := expired_count + 1;
    insert into public.workspace_notifications (workspace_id, user_id, notification_type, title, body, action_url, metadata)
    values (
      workspace_record.id,
      workspace_record.owner_id,
      'trial_expired',
      'TriCord trial ended',
      'Your free trial has ended. Subscribe to continue using TriCord. You can still export your data at any time.',
      '/app',
      jsonb_build_object('workspace_name', workspace_record.name)
    );
    insert into public.workspace_subscription_events (workspace_id, event_type, metadata)
    values (workspace_record.id, 'trial_expired', jsonb_build_object('workspace_name', workspace_record.name))
    on conflict (workspace_id, event_type) do nothing;
  end loop;
  return expired_count;
end;
$$;

-- OAuth email conversation model. Legacy provider columns are left in place for historical rows,
-- but new UI and Edge Functions should use Gmail or Microsoft 365 OAuth accounts only.
alter table public.user_email_accounts
  add column if not exists provider_account_id text,
  add column if not exists scopes text[] not null default '{}'::text[],
  add column if not exists last_sync_at timestamptz,
  add column if not exists sync_cursor text,
  add column if not exists revoked_at timestamptz;

alter table public.posts
  add column if not exists conversation_key text,
  add column if not exists email_subject text,
  add column if not exists email_provider text,
  add column if not exists email_account_id uuid references public.user_email_accounts(id) on delete set null,
  add column if not exists email_provider_thread_id text,
  add column if not exists email_provider_message_id text;
create index if not exists posts_workspace_conversation_key_idx on public.posts (workspace_id, conversation_key) where conversation_key is not null;
create index if not exists posts_email_provider_thread_idx on public.posts (workspace_id, email_provider, email_provider_thread_id) where email_provider_thread_id is not null;

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  account_id uuid references public.user_email_accounts(id) on delete set null,
  provider text not null check (provider in ('gmail', 'microsoft365', 'outlook')),
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text,
  to_emails text[] not null default '{}'::text[],
  cc_emails text[] not null default '{}'::text[],
  bcc_emails text[] not null default '{}'::text[],
  subject text,
  body_text text,
  provider_thread_id text,
  provider_message_id text,
  internet_message_id text,
  conversation_key text,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists email_messages_post_idx on public.email_messages (post_id, created_at desc);
create index if not exists email_messages_thread_idx on public.email_messages (workspace_id, provider, provider_thread_id);

alter table public.email_messages enable row level security;
drop policy if exists "Hub members read email messages" on public.email_messages;
create policy "Hub members read email messages"
on public.email_messages for select
using (exists (
  select 1 from public.memberships m
  where m.workspace_id = email_messages.workspace_id
    and m.user_id = auth.uid()
));

comment on column public.workspaces.subscription_status is 'Single TriCord subscription lifecycle: trial, active, expired, or cancelled. Expired/cancelled Hubs are read-only until subscription is active.';
comment on table public.email_messages is 'Provider-backed Gmail/Microsoft 365 email messages linked to TriCord discussions.';
comment on column public.posts.conversation_key is 'Internal immutable TriCord conversation key, e.g. TC-8F42A1, used for provider email threading and routing.';

notify pgrst, 'reload schema';
