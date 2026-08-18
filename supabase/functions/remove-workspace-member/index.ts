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

    const { membershipId } = await request.json() as { membershipId?: string };
    if (!membershipId) return json({ error: 'Membership is required.' }, 400);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Authentication required.' }, 401);

    const { data: targetMembership, error: targetError } = await adminClient
      .from('memberships')
      .select('id, workspace_id, user_id, role')
      .eq('id', membershipId)
      .maybeSingle();
    if (targetError) throw new Error(targetError.message);
    if (!targetMembership) return json({ error: 'Membership not found.' }, 404);

    const { data: requesterMembership, error: requesterError } = await adminClient
      .from('memberships')
      .select('role')
      .eq('workspace_id', targetMembership.workspace_id)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (requesterError) throw new Error(requesterError.message);
    if (requesterMembership?.role !== 'owner') return json({ error: 'Only the Hub Owner can remove people.' }, 403);
    if (targetMembership.role === 'owner') return json({ error: 'The Hub Owner cannot be removed here.' }, 400);

    const { error: removeError } = await userClient.rpc('remove_workspace_member', { target_membership_id: membershipId });
    if (removeError) throw new Error(removeError.message);

    const { count, error: countError } = await adminClient
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetMembership.user_id);
    if (countError) throw new Error(countError.message);

    const { count: ownedWorkspaceCount, error: ownedWorkspaceError } = await adminClient
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', targetMembership.user_id);
    if (ownedWorkspaceError) throw new Error(ownedWorkspaceError.message);

    let authDeleted = false;
    if ((count ?? 0) === 0 && (ownedWorkspaceCount ?? 0) === 0) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetMembership.user_id);
      if (deleteAuthError) {
        return json({
          error: `The member was removed from the Hub, but their Supabase Auth account could not be deleted: ${deleteAuthError.message}`,
        }, 400);
      }
      authDeleted = true;
    }

    return json({ removed: true, authDeleted });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Member could not be removed.' }, 400);
  }
});

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
