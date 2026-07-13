-- Must run after plus is committed as a plan_tier enum value.
update public.workspaces set plan = 'plus'::public.plan_tier, updated_at = now() where plan::text = 'business';
update public.subscriptions set plan = 'plus'::public.plan_tier, updated_at = now() where plan::text = 'business';
