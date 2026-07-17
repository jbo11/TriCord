import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);

    const { workspaceId } = await request.json() as { workspaceId?: string };
    if (!workspaceId) return json({ error: 'Hub is required.' }, 400);

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
    if (!membership) return json({ error: 'Hub access required.' }, 403);

    const { data: subscription, error: subscriptionError } = await adminClient
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_subscription_item_id, status, seat_quantity, metadata')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (subscriptionError) throw new Error(subscriptionError.message);
    if (!subscription?.stripe_subscription_id || !subscription?.stripe_subscription_item_id) {
      return json({ synced: false, reason: 'No active Stripe subscription item is linked to this Hub.' });
    }
    if (!['active', 'trialing', 'past_due'].includes(subscription.status ?? '')) {
      return json({ synced: false, reason: 'Subscription is not active.' });
    }

    const seatQuantity = await getBillableSeatCount(adminClient, workspaceId);
    await adminClient.from('subscriptions').update({
      seat_quantity: 1,
      seat_synced_at: new Date().toISOString(),
      metadata: { ...((subscription.metadata && typeof subscription.metadata === 'object') ? subscription.metadata : {}), standard_hub_employee_count: seatQuantity, included_employee_limit: 25 },
      updated_at: new Date().toISOString(),
    }).eq('workspace_id', workspaceId);

    return json({
      synced: true,
      changed: false,
      employeeCount: seatQuantity,
      includedEmployeeLimit: 25,
      reason: 'Standard Hub is a flat subscription for up to 25 employees; Stripe quantity remains 1.',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Seat billing could not be synchronized.' }, 400);
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
function requiredEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is not configured.`); return value; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
