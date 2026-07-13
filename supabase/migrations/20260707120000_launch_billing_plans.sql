-- Align launch billing to Free, Plus, and Pro while preserving legacy enum values
-- that may already exist in a live database.
do $$
begin
  alter type public.plan_tier add value if not exists 'plus';
exception
  when duplicate_object then null;
end $$;


alter table public.subscriptions
  add column if not exists stripe_price_id text,
  add column if not exists stripe_current_period_start timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists trial_end timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on type public.plan_tier is 'TriCord launch plans are free, plus, and pro. business and enterprise are legacy enum values retained for safe live-database compatibility.';
comment on table public.subscriptions is 'Hub-level billing state synchronized from Stripe webhooks.';
