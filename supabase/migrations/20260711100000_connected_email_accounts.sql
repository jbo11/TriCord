-- Connected Email Accounts: encrypted sending identities and delivery audit logs.

create table if not exists private.email_account_encryption_keys (
  id boolean primary key default true,
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
insert into private.email_account_encryption_keys (id) values (true) on conflict (id) do nothing;

create table if not exists public.email_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook', 'microsoft365')),
  consumed_at timestamptz,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now()
);
create index if not exists email_oauth_states_user_idx on public.email_oauth_states (user_id, workspace_id, provider, expires_at desc);
alter table public.email_oauth_states enable row level security;
drop policy if exists "Users create own email oauth states" on public.email_oauth_states;
create policy "Users create own email oauth states" on public.email_oauth_states for insert
with check (user_id = auth.uid() and exists (select 1 from public.memberships m where m.workspace_id = email_oauth_states.workspace_id and m.user_id = auth.uid()));
drop policy if exists "Users read own email oauth states" on public.email_oauth_states;
create policy "Users read own email oauth states" on public.email_oauth_states for select
using (user_id = auth.uid());


create table if not exists public.user_email_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook', 'microsoft365', 'resend', 'smtp')),
  email_address text not null,
  display_name text,
  access_token_encrypted bytea,
  refresh_token_encrypted bytea,
  token_expiry timestamptz,
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password_encrypted bytea,
  smtp_encryption text check (smtp_encryption is null or smtp_encryption in ('ssl_tls', 'starttls', 'none')),
  is_default boolean not null default false,
  is_connected boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider, email_address)
);

create index if not exists user_email_accounts_workspace_user_idx on public.user_email_accounts (workspace_id, user_id, is_connected, is_default);
create index if not exists user_email_accounts_provider_idx on public.user_email_accounts (provider, is_connected);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  comment_id uuid references public.comments(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  provider text not null,
  sender text not null,
  recipient text not null,
  cc text[] not null default '{}',
  bcc text[] not null default '{}',
  subject text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists email_delivery_logs_workspace_idx on public.email_delivery_logs (workspace_id, created_at desc);
create index if not exists email_delivery_logs_post_idx on public.email_delivery_logs (post_id, created_at desc);

alter table public.user_email_accounts enable row level security;
alter table public.email_delivery_logs enable row level security;

drop policy if exists "Users read own connected email accounts" on public.user_email_accounts;
create policy "Users read own connected email accounts"
on public.user_email_accounts for select
using (
  user_id = auth.uid()
  and exists (select 1 from public.memberships m where m.workspace_id = user_email_accounts.workspace_id and m.user_id = auth.uid())
);

drop policy if exists "Users create own connected email accounts" on public.user_email_accounts;
create policy "Users create own connected email accounts"
on public.user_email_accounts for insert
with check (
  user_id = auth.uid()
  and exists (select 1 from public.memberships m where m.workspace_id = user_email_accounts.workspace_id and m.user_id = auth.uid())
);

drop policy if exists "Users update own connected email accounts" on public.user_email_accounts;
create policy "Users update own connected email accounts"
on public.user_email_accounts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users delete own connected email accounts" on public.user_email_accounts;
create policy "Users delete own connected email accounts"
on public.user_email_accounts for delete
using (user_id = auth.uid());

drop policy if exists "Users read own email delivery logs" on public.email_delivery_logs;
create policy "Users read own email delivery logs"
on public.email_delivery_logs for select
using (
  user_id = auth.uid()
  or public.has_workspace_capability(workspace_id, 'view_audit')
);



create or replace function public.service_upsert_connected_email_account(
  target_workspace_id uuid,
  target_user_id uuid,
  target_provider text,
  target_email_address text,
  target_display_name text,
  new_access_token text,
  new_refresh_token text,
  new_token_expiry timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  encryption_secret text;
  account_id uuid;
begin
  if target_provider not in ('gmail', 'outlook', 'microsoft365') then raise exception 'Unsupported email provider.'; end if;
  if not exists (select 1 from public.memberships m where m.workspace_id = target_workspace_id and m.user_id = target_user_id) then raise exception 'Not allowed.'; end if;
  select secret into encryption_secret from private.email_account_encryption_keys where id = true;
  insert into public.user_email_accounts (
    workspace_id, user_id, provider, email_address, display_name,
    access_token_encrypted, refresh_token_encrypted, token_expiry,
    is_connected, is_default, last_error, updated_at
  ) values (
    target_workspace_id, target_user_id, target_provider, lower(trim(target_email_address)), nullif(trim(target_display_name), ''),
    case when nullif(new_access_token, '') is null then null else extensions.pgp_sym_encrypt(new_access_token, encryption_secret) end,
    case when nullif(new_refresh_token, '') is null then null else extensions.pgp_sym_encrypt(new_refresh_token, encryption_secret) end,
    new_token_expiry,
    true,
    not exists (select 1 from public.user_email_accounts a where a.workspace_id = target_workspace_id and a.user_id = target_user_id and a.is_connected),
    null,
    now()
  )
  on conflict (workspace_id, user_id, provider, email_address)
  do update set
    display_name = excluded.display_name,
    access_token_encrypted = coalesce(excluded.access_token_encrypted, public.user_email_accounts.access_token_encrypted),
    refresh_token_encrypted = coalesce(excluded.refresh_token_encrypted, public.user_email_accounts.refresh_token_encrypted),
    token_expiry = excluded.token_expiry,
    is_connected = true,
    last_error = null,
    updated_at = now()
  returning id into account_id;
  return account_id;
end;
$$;

create or replace function public.upsert_connected_email_account(
  target_workspace_id uuid,
  target_provider text,
  target_email_address text,
  target_display_name text,
  new_access_token text,
  new_refresh_token text,
  new_token_expiry timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  encryption_secret text;
  account_id uuid;
begin
  if target_provider not in ('gmail', 'outlook', 'microsoft365') then raise exception 'Unsupported email provider.'; end if;
  if not exists (select 1 from public.memberships m where m.workspace_id = target_workspace_id and m.user_id = auth.uid()) then raise exception 'Not allowed.'; end if;
  select secret into encryption_secret from private.email_account_encryption_keys where id = true;
  insert into public.user_email_accounts (
    workspace_id, user_id, provider, email_address, display_name,
    access_token_encrypted, refresh_token_encrypted, token_expiry,
    is_connected, is_default, last_error, updated_at
  ) values (
    target_workspace_id, auth.uid(), target_provider, lower(trim(target_email_address)), nullif(trim(target_display_name), ''),
    case when nullif(new_access_token, '') is null then null else extensions.pgp_sym_encrypt(new_access_token, encryption_secret) end,
    case when nullif(new_refresh_token, '') is null then null else extensions.pgp_sym_encrypt(new_refresh_token, encryption_secret) end,
    new_token_expiry,
    true,
    not exists (select 1 from public.user_email_accounts a where a.workspace_id = target_workspace_id and a.user_id = auth.uid() and a.is_connected),
    null,
    now()
  )
  on conflict (workspace_id, user_id, provider, email_address)
  do update set
    display_name = excluded.display_name,
    access_token_encrypted = coalesce(excluded.access_token_encrypted, public.user_email_accounts.access_token_encrypted),
    refresh_token_encrypted = coalesce(excluded.refresh_token_encrypted, public.user_email_accounts.refresh_token_encrypted),
    token_expiry = excluded.token_expiry,
    is_connected = true,
    last_error = null,
    updated_at = now()
  returning id into account_id;
  return account_id;
end;
$$;

create or replace function public.get_email_account_for_sending(target_account_id uuid)
returns table (
  id uuid,
  provider text,
  email_address text,
  display_name text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  encryption_secret text;
begin
  select secret into encryption_secret from private.email_account_encryption_keys where id = true;
  return query
  select a.id,
         a.provider,
         a.email_address,
         a.display_name,
         case when a.access_token_encrypted is null then null else extensions.pgp_sym_decrypt(a.access_token_encrypted, encryption_secret) end,
         case when a.refresh_token_encrypted is null then null else extensions.pgp_sym_decrypt(a.refresh_token_encrypted, encryption_secret) end,
         a.token_expiry
  from public.user_email_accounts a
  where a.id = target_account_id
    and a.user_id = auth.uid()
    and a.is_connected = true;
end;
$$;

create or replace function public.update_email_account_access_token(
  target_account_id uuid,
  new_access_token text,
  new_token_expiry timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare encryption_secret text;
begin
  if not exists (select 1 from public.user_email_accounts a where a.id = target_account_id and a.user_id = auth.uid()) then raise exception 'Not allowed.'; end if;
  select secret into encryption_secret from private.email_account_encryption_keys where id = true;
  update public.user_email_accounts
  set access_token_encrypted = extensions.pgp_sym_encrypt(new_access_token, encryption_secret),
      token_expiry = new_token_expiry,
      updated_at = now(),
      last_error = null
  where id = target_account_id;
end;
$$;

create or replace function public.set_default_email_account(target_account_id uuid)
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
  set is_default = false, updated_at = now()
  where workspace_id = account_row.workspace_id and user_id = account_row.user_id;
  update public.user_email_accounts
  set is_default = true, updated_at = now()
  where id = target_account_id;
end;
$$;

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
      updated_at = now()
  where id = target_account_id;
end;
$$;


comment on table public.user_email_accounts is 'Per-user sending identities for Room email from TriCord. Secret values are stored encrypted and should be managed by Edge Functions.';
comment on table public.email_delivery_logs is 'Audit log for outbound email sent from Room discussions.';



revoke all on function public.service_upsert_connected_email_account(uuid, uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.service_upsert_connected_email_account(uuid, uuid, text, text, text, text, text, timestamptz) to service_role;

revoke all on function public.upsert_connected_email_account(uuid, text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.upsert_connected_email_account(uuid, text, text, text, text, text, timestamptz) to authenticated;

revoke all on function public.get_email_account_for_sending(uuid) from public, anon;
grant execute on function public.get_email_account_for_sending(uuid) to authenticated;

revoke all on function public.update_email_account_access_token(uuid, text, timestamptz) from public, anon;
grant execute on function public.update_email_account_access_token(uuid, text, timestamptz) to authenticated;

revoke all on function public.set_default_email_account(uuid) from public, anon;
grant execute on function public.set_default_email_account(uuid) to authenticated;

revoke all on function public.disconnect_email_account(uuid) from public, anon;
grant execute on function public.disconnect_email_account(uuid) to authenticated;

notify pgrst, 'reload schema';
