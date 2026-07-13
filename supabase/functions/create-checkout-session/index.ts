import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

type Plan = 'plus' | 'pro';
type Interval = 'monthly' | 'yearly';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);

    const { workspaceId, plan, interval } = await request.json() as { workspaceId?: string; plan?: Plan; interval?: Interval };
    if (!workspaceId || !isPlan(plan) || !isInterval(interval)) return json({ error: 'Hub, plan, and billing interval are required.' }, 400);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Authentication required.' }, 401);

    const { data: membership } = await userClient
      .from('memberships')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (membership?.role !== 'owner') return json({ error: 'Only the Hub Owner can manage billing.' }, 403);

    const { data: workspace, error: workspaceError } = await adminClient
      .from('workspaces')
      .select('id, name, plan')
      .eq('id', workspaceId)
      .single();
    if (workspaceError || !workspace) return json({ error: 'Hub not found.' }, 404);

    const priceId = requiredEnv(priceEnvName(plan, interval));
    validateStripePriceId(priceId, priceEnvName(plan, interval));
    const seatQuantity = await getBillableSeatCount(adminClient, workspaceId);
    const appUrl = requiredEnv('APP_URL').replace(/\/$/, '');
    const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'));

    const { data: existingSubscription } = await adminClient
      .from('subscriptions')
      .select('id, stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    let customerId = existingSubscription?.stripe_customer_id ?? '';
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: authData.user.email ?? undefined,
        name: workspace.name,
        metadata: { workspace_id: workspaceId, owner_user_id: authData.user.id },
      });
      customerId = customer.id;
      await adminClient.from('subscriptions').upsert({
        workspace_id: workspaceId,
        stripe_customer_id: customerId,
        plan,
        status: 'incomplete',
        seat_quantity: seatQuantity,
        seat_synced_at: new Date().toISOString(),
        metadata: { checkout_plan: plan, checkout_interval: interval, checkout_seats: seatQuantity },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{ price: priceId, quantity: seatQuantity }],
      success_url: `${appUrl}/app?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app?billing=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: workspaceId,
      metadata: { workspace_id: workspaceId, plan, interval, seat_quantity: String(seatQuantity) },
      subscription_data: { metadata: { workspace_id: workspaceId, plan, interval } },
    });

    return json({ url: session.url, seatQuantity });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Checkout could not be started.' }, 400);
  }
});

async function getBillableSeatCount(adminClient: ReturnType<typeof createClient>, workspaceId: string) {
  const { count, error } = await adminClient
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin', 'member']);
  if (error) throw new Error(error.message);
  return Math.max(count ?? 1, 1);
}
function priceEnvName(plan: Plan, interval: Interval) {
  return `STRIPE_${plan.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
}
function validateStripePriceId(value: string, envName: string) {
  if (!value.startsWith('price_')) {
    throw new Error(`${envName} must be a Stripe Price ID beginning with price_. You entered ${value.startsWith('prod_') ? 'a Product ID' : 'a non-price ID'}. Create recurring Prices in Stripe and copy their price_ IDs.`);
  }
}
function isPlan(value: unknown): value is Plan { return value === 'plus' || value === 'pro'; }
function isInterval(value: unknown): value is Interval { return value === 'monthly' || value === 'yearly'; }
function requiredEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is not configured.`); return value; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
