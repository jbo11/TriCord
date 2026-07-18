-- OAuth mailbox hardening for TriCord connected email.
-- Keeps the legacy room-email columns for compatibility, while the app uses per-user Gmail/Microsoft 365 OAuth mailboxes.

alter table public.email_oauth_states
  add column if not exists code_verifier text;

alter table public.email_delivery_logs
  add column if not exists account_id uuid references public.user_email_accounts(id) on delete set null;

alter table public.user_email_accounts
  add column if not exists provider_account_id text,
  add column if not exists scopes text[] not null default '{}'::text[],
  add column if not exists last_sync_at timestamptz,
  add column if not exists sync_cursor text,
  add column if not exists revoked_at timestamptz;

update public.user_email_accounts
set is_connected = false,
    is_default = false,
    last_error = 'Legacy email provider disabled. Connect Gmail or Microsoft 365.',
    revoked_at = coalesce(revoked_at, now()),
    updated_at = now()
where provider in ('resend', 'smtp');

alter table public.user_email_accounts drop constraint if exists user_email_accounts_provider_check;
alter table public.user_email_accounts
  add constraint user_email_accounts_provider_check
  check (provider in ('gmail', 'outlook', 'microsoft365')) not valid;

create table if not exists public.email_integration_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  account_id uuid references public.user_email_accounts(id) on delete set null,
  provider text not null,
  event_type text not null check (event_type in ('mailbox_connected', 'mailbox_disconnected', 'token_refreshed', 'outgoing_sent', 'outgoing_failed', 'sync_failed')),
  status text not null default 'ok' check (status in ('ok', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_integration_events_workspace_idx on public.email_integration_events (workspace_id, created_at desc);
create index if not exists email_integration_events_account_idx on public.email_integration_events (account_id, created_at desc);
create index if not exists email_delivery_logs_account_idx on public.email_delivery_logs (account_id, created_at desc);

alter table public.email_integration_events enable row level security;

drop policy if exists "Users read own email integration events" on public.email_integration_events;
create policy "Users read own email integration events"
on public.email_integration_events for select
using (
  user_id = auth.uid()
  or public.has_workspace_capability(workspace_id, 'view_audit')
);

create or replace function public.disconnect_email_account(target_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare account_row public.user_email_accounts%rowtype;
begin
  select * into account_row from public.user_email_accounts where id = target_account_id;
  if not found then raise exception 'Email account not found.'; end if;
  if account_row.user_id <> auth.uid() then raise exception 'Not allowed.'; end if;

  update public.user_email_accounts
  set is_connected = false,
      is_default = false,
      access_token_encrypted = null,
      refresh_token_encrypted = null,
      smtp_password_encrypted = null,
      revoked_at = now(),
      updated_at = now()
  where id = target_account_id;

  insert into public.email_integration_events (workspace_id, user_id, account_id, provider, event_type, status)
  values (account_row.workspace_id, account_row.user_id, account_row.id, account_row.provider, 'mailbox_disconnected', 'ok');
end;
$$;

revoke all on function public.disconnect_email_account(uuid) from public, anon;
grant execute on function public.disconnect_email_account(uuid) to authenticated;

comment on table public.user_email_accounts is 'Per-user OAuth email integrations for sending email from TriCord discussions. Secrets are encrypted and managed by Edge Functions.';
comment on table public.email_delivery_logs is 'Audit log for outbound email sent from user-connected Gmail or Microsoft 365 mailboxes.';
comment on table public.email_integration_events is 'Audit history for connected mailbox lifecycle and email sending events.';

notify pgrst, 'reload schema';
