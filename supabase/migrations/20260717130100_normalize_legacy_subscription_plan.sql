-- Normalize legacy paid plan rows after tricord is available in public.plan_tier.

update public.workspaces
set plan = 'tricord'::public.plan_tier,
    updated_at = now()
where coalesce(plan, 'free') in ('plus', 'pro', 'business', 'enterprise')
  and subscription_status = 'active';

update public.subscriptions
set plan = 'tricord'::public.plan_tier,
    updated_at = now()
where coalesce(plan, 'free') in ('plus', 'pro', 'business', 'enterprise');
