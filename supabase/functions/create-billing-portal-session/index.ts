import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

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

    const { data: membership } = await userClient.from('memberships').select('role').eq('workspace_id', workspaceId).eq('user_id', authData.user.id).maybeSingle();
    if (membership?.role !== 'owner') return json({ error: 'Only the Hub Owner can manage billing.' }, 403);

    const { data: subscription } = await adminClient.from('subscriptions').select('stripe_customer_id').eq('workspace_id', workspaceId).maybeSingle();
    if (!subscription?.stripe_customer_id) return json({ error: 'No Stripe customer exists for this Hub yet.' }, 404);

    const appUrl = requiredEnv('APP_URL').replace(/\/$/, '');
    const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
    const portal = await stripe.billingPortal.sessions.create({ customer: subscription.stripe_customer_id, return_url: `${appUrl}/app` });
    return json({ url: portal.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Billing portal could not be opened.' }, 400);
  }
});

function requiredEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is not configured.`); return value; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
