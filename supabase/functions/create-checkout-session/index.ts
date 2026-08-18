import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

type Plan = 'tricord';
type Interval = 'monthly' | 'yearly';
const STANDARD_HUB_EMPLOYEE_LIMIT = 25;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);

    const { workspaceId, plan, interval } = await request.json() as { workspaceId?: string; plan?: Plan; interval?: Interval };
    if (!workspaceId || !isPlan(plan) || !isInterval(interval)) return json({ error: 'Hub and billing interval are required.' }, 400);
    const selectedPlan: Plan = 'tricord';

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const publishableKey = requiredEnv('EDGE_SUPABASE_PUBLISHABLE_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
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
      .select('id, name, subscription_status')
      .eq('id', workspaceId)
      .single();
    if (workspaceError || !workspace) return json({ error: 'Hub not found.' }, 404);

    const priceEnv = priceEnvName(selectedPlan, interval);
    const fallbackPriceEnv = fallbackPriceEnvName(interval);
    const configuredPriceId = Deno.env.get(priceEnv);
    const priceId = configuredPriceId || requiredEnv(fallbackPriceEnv);
    validateStripePriceId(priceId, configuredPriceId ? priceEnv : fallbackPriceEnv);
    const employeeCount = await getBillableSeatCount(adminClient, workspaceId);
    if (employeeCount > STANDARD_HUB_EMPLOYEE_LIMIT) {
      return json({ error: 'This Hub has more than 25 employees. Please contact TriCord for a custom plan.' }, 400);
    }
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
        plan: 'tricord',
        status: 'incomplete',
        seat_quantity: 1,
        seat_synced_at: new Date().toISOString(),
        metadata: { checkout_plan: 'tricord', checkout_interval: interval, checkout_employee_count: employeeCount },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app?billing=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: workspaceId,
      metadata: { workspace_id: workspaceId, plan: 'tricord', interval, employee_count: String(employeeCount) },
      subscription_data: { metadata: { workspace_id: workspaceId, plan: 'tricord', interval } },
    });

    return json({ url: session.url, employeeCount, includedEmployeeLimit: STANDARD_HUB_EMPLOYEE_LIMIT });
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
function priceEnvName(_plan: Plan, interval: Interval) {
  return interval === 'monthly' ? 'STRIPE_TRICORD_MONTHLY_PRICE_ID' : 'STRIPE_TRICORD_YEARLY_PRICE_ID';
}
function fallbackPriceEnvName(interval: Interval) {
  return interval === 'monthly' ? 'STRIPE_PRO_MONTHLY_PRICE_ID' : 'STRIPE_PRO_YEARLY_PRICE_ID';
}
function validateStripePriceId(value: string, envName: string) {
  if (!value.startsWith('price_')) {
    throw new Error(`${envName} must be a Stripe Price ID beginning with price_. You entered ${value.startsWith('prod_') ? 'a Product ID' : 'a non-price ID'}. Create recurring Prices in Stripe and copy their price_ IDs.`);
  }
}
function isPlan(value: unknown): value is Plan { return !value || value === 'tricord'; }
function isInterval(value: unknown): value is Interval { return value === 'monthly' || value === 'yearly'; }
function requiredEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is not configured.`); return value; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
