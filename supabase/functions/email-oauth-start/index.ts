import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

type Provider = 'gmail' | 'outlook' | 'microsoft365';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Authentication required.' }, 401);

    const { workspaceId, provider } = await request.json() as { workspaceId?: string; provider?: Provider };
    if (!workspaceId || !provider || !['gmail', 'outlook', 'microsoft365'].includes(provider)) return json({ error: 'Hub and provider are required.' }, 400);

    const { data: membership } = await client
      .from('memberships')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'You do not have access to this Hub.' }, 403);

    const { data: stateRow, error: stateError } = await client
      .from('email_oauth_states')
      .insert({ workspace_id: workspaceId, user_id: authData.user.id, provider })
      .select('id')
      .single();
    if (stateError || !stateRow) return json({ error: stateError?.message || 'Could not start email connection.' }, 400);

    return json({ authUrl: buildAuthUrl(provider, stateRow.id) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not start email connection.' }, 400);
  }
});

function buildAuthUrl(provider: Provider, state: string) {
  const redirectUri = oauthRedirectUri();
  if (provider === 'gmail') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', requiredEnv('GOOGLE_OAUTH_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/gmail.send');
    url.searchParams.set('state', state);
    return url.toString();
  }

  const tenant = Deno.env.get('MICROSOFT_OAUTH_TENANT') || 'common';
  const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', requiredEnv('MICROSOFT_OAUTH_CLIENT_ID'));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'openid email profile offline_access User.Read Mail.Send');
  url.searchParams.set('state', state);
  return url.toString();
}

function oauthRedirectUri() {
  return Deno.env.get('EMAIL_OAUTH_REDIRECT_URL') || `${requiredEnv('SUPABASE_URL')}/functions/v1/email-oauth-callback`;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
