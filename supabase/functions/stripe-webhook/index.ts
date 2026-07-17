import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed.', { status: 405 });

  const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing Stripe signature.', { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, requiredEnv('STRIPE_WEBHOOK_SECRET'));
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Webhook signature verification failed.', { status: 400 });
  }

  const adminClient = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
  const workspaceId = getWorkspaceId(event);

  try {
    await adminClient.from('billing_events').insert({
      workspace_id: workspaceId,
      stripe_event_id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed_at: new Date().toISOString(),
    });
  } catch {
    // Duplicate Stripe events are safe to acknowledge after the first successful insert.
  }

  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription;
    const targetWorkspaceId = subscription.metadata?.workspace_id;
    if (targetWorkspaceId) await syncSubscription(adminClient, subscription, targetWorkspaceId);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const targetWorkspaceId = session.metadata?.workspace_id || session.client_reference_id || undefined;
    if (targetWorkspaceId && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
      await syncSubscription(adminClient, subscription, targetWorkspaceId);
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});

async function syncSubscription(adminClient: ReturnType<typeof createClient>, subscription: Stripe.Subscription, workspaceId: string) {
  const plan = 'tricord';
  const firstItem = subscription.items.data[0];
  const seatQuantity = firstItem?.quantity ?? null;
  await adminClient.from('subscriptions').upsert({
    workspace_id: workspaceId,
    stripe_customer_id: String(subscription.customer),
    stripe_subscription_id: subscription.id,
    stripe_subscription_item_id: firstItem?.id ?? null,
    stripe_price_id: firstItem?.price.id ?? null,
    plan,
    status: subscription.status,
    current_period_end: timestamp(subscription.current_period_end),
    stripe_current_period_start: timestamp(subscription.current_period_start),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end: timestamp(subscription.trial_end),
    seat_quantity: seatQuantity,
    seat_synced_at: seatQuantity ? new Date().toISOString() : null,
    metadata: subscription.metadata ?? {},
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id' });

  if (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due') {
    await adminClient.from('workspaces').update({
      subscription_status: 'active',
      subscription_started_at: new Date().toISOString(),
      subscription_cancelled_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', workspaceId);
  }
  if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
    await adminClient.from('workspaces').update({
      subscription_status: 'cancelled',
      subscription_cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', workspaceId);
  }
}

function timestamp(value: number | null | undefined) { return value ? new Date(value * 1000).toISOString() : null; }
function getWorkspaceId(event: Stripe.Event) {
  const object = event.data.object as { metadata?: { workspace_id?: string }; client_reference_id?: string | null };
  return object.metadata?.workspace_id ?? object.client_reference_id ?? null;
}
function requiredEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is not configured.`); return value; }
