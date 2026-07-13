alter table public.subscriptions
  add column if not exists stripe_subscription_item_id text unique,
  add column if not exists seat_quantity integer not null default 1 check (seat_quantity >= 1),
  add column if not exists seat_synced_at timestamptz;

create index if not exists subscriptions_workspace_status_idx
on public.subscriptions (workspace_id, status);

create index if not exists subscriptions_stripe_subscription_item_idx
on public.subscriptions (stripe_subscription_item_id)
where stripe_subscription_item_id is not null;

comment on column public.subscriptions.seat_quantity is 'Current Stripe subscription quantity for paid Hub seats. Owners, Admins, and Members are billable; Guests are not.';
comment on column public.subscriptions.stripe_subscription_item_id is 'Stripe subscription item used to update paid seat quantity.';
