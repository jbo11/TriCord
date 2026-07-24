import { createClient } from 'npm:@supabase/supabase-js@2';

type Provider = 'gmail' | 'outlook' | 'microsoft365';

Deno.serve(async (request) => {
  if (request.method !== 'GET') return redirectWithStatus('email_error=method');

  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const providerError = url.searchParams.get('error') || '';
  if (providerError) return redirectWithStatus(`email_error=${encodeURIComponent(providerError)}`);
  if (!code || !state) return redirectWithStatus('email_error=missing_code');

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: stateRow, error: stateError } = await admin
      .from('email_oauth_states')
      .select('id, workspace_id, user_id, provider, code_verifier, consumed_at, expires_at')
      .eq('id', state)
      .maybeSingle();
    if (stateError || !stateRow || stateRow.consumed_at || new Date(stateRow.expires_at).getTime() < Date.now()) {
      return redirectWithStatus('email_error=expired_state');
    }
    if (!stateRow.code_verifier) return redirectWithStatus('email_error=missing_pkce');

    const provider = stateRow.provider as Provider;
    const tokenResult = provider === 'gmail'
      ? await exchangeGoogleCode(code, stateRow.code_verifier)
      : await exchangeMicrosoftCode(code, stateRow.code_verifier);
    const profile = provider === 'gmail'
      ? await fetchGoogleProfile(tokenResult.access_token)
      : await fetchMicrosoftProfile(tokenResult.access_token);

    const { data: accountId, error: upsertError } = await admin.rpc('service_upsert_connected_email_account', {
      target_workspace_id: stateRow.workspace_id,
      target_user_id: stateRow.user_id,
      target_provider: provider,
      target_email_address: profile.email,
      target_display_name: profile.name || profile.email,
      new_access_token: tokenResult.access_token,
      new_refresh_token: tokenResult.refresh_token || '',
      new_token_expiry: new Date(Date.now() + Number(tokenResult.expires_in || 3600) * 1000).toISOString(),
    });
    if (upsertError) throw new Error(upsertError.message);

    if (accountId) {
      await admin
        .from('user_email_accounts')
        .update({ provider_account_id: profile.providerAccountId, scopes: splitScopes(tokenResult.scope), last_sync_at: null, revoked_at: null, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      await admin.from('email_integration_events').insert({
        workspace_id: stateRow.workspace_id,
        user_id: stateRow.user_id,
        account_id: accountId,
        provider,
        event_type: 'mailbox_connected',
        status: 'ok',
        metadata: { email_address: profile.email },
      });
    }

    await admin.from('email_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('id', stateRow.id);
    return redirectWithStatus('email_connected=1');
  } catch (error) {
    console.error('email oauth callback failed', error);
    return redirectWithStatus(`email_error=${encodeURIComponent(error instanceof Error ? error.message : 'connection_failed')}`);
  }
});

async function exchangeGoogleCode(code: string, codeVerifier: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: oauthRedirectUri(),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.error || 'Google authorization failed.');
  return result as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

async function exchangeMicrosoftCode(code: string, codeVerifier: string) {
  const tenant = Deno.env.get('MICROSOFT_OAUTH_TENANT') || Deno.env.get('MICROSOFT_TENANT_ID') || 'common';
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('MICROSOFT_OAUTH_CLIENT_ID'),
      client_secret: requiredEnv('MICROSOFT_OAUTH_CLIENT_SECRET'),
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: oauthRedirectUri(),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.error || 'Microsoft authorization failed.');
  return result as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  const result = await response.json();
  if (!response.ok || !result.email) throw new Error('Could not read Google email address.');
  return { email: String(result.email).toLowerCase(), name: result.name ? String(result.name) : String(result.email), providerAccountId: result.sub ? String(result.sub) : null };
}

async function fetchMicrosoftProfile(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', { headers: { Authorization: `Bearer ${accessToken}` } });
  const result = await response.json();
  const email = result.mail || result.userPrincipalName;
  if (!response.ok || !email) throw new Error('Could not read Microsoft email address.');
  return { email: String(email).toLowerCase(), name: result.displayName ? String(result.displayName) : String(email), providerAccountId: result.id ? String(result.id) : null };
}

function splitScopes(scope?: string) {
  return (scope || '').split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function oauthRedirectUri() {
  return Deno.env.get('EMAIL_OAUTH_REDIRECT_URL') || `${requiredEnv('SUPABASE_URL')}/functions/v1/email-oauth-callback`;
}

function redirectWithStatus(query: string) {
  const appOrigin = (Deno.env.get('APP_ORIGIN') || 'https://jbo11.github.io/TriCord').replace(/\/+$/, '');
  return Response.redirect(`${appOrigin}/app?${query}`, 302);
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

