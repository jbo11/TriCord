-- Fix ambiguous id references in the connected mailbox RPCs used by send-room-email.

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
  select key_row.secret
    into encryption_secret
  from private.email_account_encryption_keys as key_row
  where key_row.id = true;

  return query
  select account.id,
         account.provider,
         account.email_address,
         account.display_name,
         case
           when account.access_token_encrypted is null then null
           else extensions.pgp_sym_decrypt(account.access_token_encrypted, encryption_secret)
         end,
         case
           when account.refresh_token_encrypted is null then null
           else extensions.pgp_sym_decrypt(account.refresh_token_encrypted, encryption_secret)
         end,
         account.token_expiry
  from public.user_email_accounts as account
  where account.id = target_account_id
    and account.user_id = auth.uid()
    and account.is_connected = true;
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
declare
  encryption_secret text;
begin
  if not exists (
    select 1
    from public.user_email_accounts as account
    where account.id = target_account_id
      and account.user_id = auth.uid()
  ) then
    raise exception 'Not allowed.';
  end if;

  select key_row.secret
    into encryption_secret
  from private.email_account_encryption_keys as key_row
  where key_row.id = true;

  update public.user_email_accounts as account
  set access_token_encrypted = extensions.pgp_sym_encrypt(new_access_token, encryption_secret),
      token_expiry = new_token_expiry,
      updated_at = now(),
      last_error = null
  where account.id = target_account_id;
end;
$$;

revoke all on function public.get_email_account_for_sending(uuid) from public, anon;
grant execute on function public.get_email_account_for_sending(uuid) to authenticated;

revoke all on function public.update_email_account_access_token(uuid, text, timestamptz) from public, anon;
grant execute on function public.update_email_account_access_token(uuid, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
