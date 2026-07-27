import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

type Provider = 'gmail' | 'outlook' | 'microsoft365';

interface SendEmailRequest {
  workspaceId?: string;
  postId?: string;
  to?: string;
  cc?: string[];
  bcc?: string[];
  body?: string;
  subject?: string;
  providerAccountId?: string;
}

interface SenderIdentity {
  provider: Provider;
  sender: string;
  accountId: string | null;
  displayName?: string | null;
  replyTo?: string | null;
}

interface EmailAccountSecret {
  id: string;
  provider: Provider;
  email_address: string;
  display_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const anonKey = requiredEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  let auditBase: Record<string, unknown> | null = null;

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);

    const input = await request.json() as SendEmailRequest;
    const workspaceId = String(input.workspaceId || '');
    const postId = String(input.postId || '');
    const to = normalizeEmail(input.to || '');
    const cc = (input.cc ?? []).map(normalizeEmail).filter(Boolean).slice(0, 10);
    const bcc = (input.bcc ?? []).map(normalizeEmail).filter(Boolean).slice(0, 10);
    const body = String(input.body || '').trim();
    const subject = sanitizeSubject(input.subject || 'TriCord message');

    if (!workspaceId || !postId || !to || !body) return json({ error: 'Hub, post, recipient, and message are required.' }, 400);
    if (body.length > 10000) return json({ error: 'Email message is too long.' }, 400);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Authentication required.' }, 401);

    const { data: membership } = await userClient
      .from('memberships')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'You do not have access to this Hub.' }, 403);

    const { data: post, error: postError } = await adminClient
      .from('posts')
      .select('id, title, workspace_id, space_id, metadata')
      .eq('id', postId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (postError || !post) return json({ error: 'Post not found.' }, 404);

    const { data: room, error: roomError } = await adminClient
      .from('spaces')
      .select('id, name')
      .eq('id', post.space_id)
      .maybeSingle();
    if (roomError || !room) return json({ error: 'Room not found.' }, 404);

    const userIdentity = await loadUserIdentity(adminClient, authData.user.id, authData.user.email || '');
    const identity = await selectSenderIdentity(adminClient, workspaceId, authData.user.id, input.providerAccountId || '', userIdentity.email, userIdentity.name);
    auditBase = { workspace_id: workspaceId, post_id: postId, user_id: authData.user.id, account_id: identity.accountId, provider: identity.provider, sender: identity.sender, reply_to: identity.replyTo, recipient: to, cc, bcc, subject };

    const result = await sendWithProvider(userClient, identity, { to, cc, bcc, subject: subject || `Re: ${post.title}`, text: body });
    await adminClient.from('email_delivery_logs').insert({ ...auditBase, status: 'sent', message_id: result.messageId ?? null });
    await logIntegrationEvent(adminClient, {
      workspaceId,
      userId: authData.user.id,
      accountId: identity.accountId,
      provider: identity.provider,
      eventType: 'outgoing_sent',
      status: 'ok',
      metadata: { post_id: postId, recipient: to, cc, bcc, subject, message_id: result.messageId ?? null },
    });
    return json({ ok: true, provider: identity.provider, sender: identity.sender, id: result.messageId ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email could not be sent.';
    if (auditBase) {
      await adminClient.from('email_delivery_logs').insert({ ...auditBase, status: 'failed', error_message: message });
      await logIntegrationEvent(adminClient, {
        workspaceId: String(auditBase.workspace_id),
        userId: String(auditBase.user_id),
        accountId: typeof auditBase.account_id === 'string' ? auditBase.account_id : null,
        provider: String(auditBase.provider),
        eventType: 'outgoing_failed',
        status: 'error',
        metadata: { post_id: auditBase.post_id, recipient: auditBase.recipient, cc: auditBase.cc, bcc: auditBase.bcc, subject: auditBase.subject, error_message: message },
      });
    }
    return json({ error: friendlyEmailError(message) }, 400);
  }
});

async function loadUserIdentity(adminClient: ReturnType<typeof createClient>, userId: string, fallbackEmail: string) {
  const { data } = await adminClient
    .from('users')
    .select('email, display_name, full_name, nickname')
    .eq('id', userId)
    .maybeSingle();
  const email = normalizeEmail(String(data?.email || fallbackEmail || ''));
  const name = String(data?.full_name || data?.display_name || data?.nickname || email.split('@')[0] || 'TriCord member');
  return { email, name };
}

async function selectSenderIdentity(adminClient: ReturnType<typeof createClient>, workspaceId: string, userId: string, preferredAccountId: string, userEmail: string, userDisplayName: string): Promise<SenderIdentity> {
  const { data: accounts, error } = await adminClient
    .from('user_email_accounts')
    .select('id, provider, email_address, display_name, is_default, is_connected, last_error')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('is_connected', true);
  if (error) throw new Error(error.message);

  const priority: Provider[] = ['gmail', 'outlook', 'microsoft365'];
  const selected = preferredAccountId
    ? accounts?.find((account) => account.id === preferredAccountId)
    : accounts?.find((account) => account.is_default) ?? [...(accounts ?? [])].sort((a, b) => priority.indexOf(a.provider as Provider) - priority.indexOf(b.provider as Provider))[0];

  if (selected) {
    return { provider: selected.provider as Provider, sender: selected.email_address, accountId: selected.id, displayName: userDisplayName || selected.display_name, replyTo: selected.email_address };
  }

  throw new Error(`Email delivery is not configured for ${userEmail || 'this TriCord account'}.`);
}

async function sendWithProvider(userClient: ReturnType<typeof createClient>, identity: SenderIdentity, email: { to: string; cc: string[]; bcc: string[]; subject: string; text: string }) {
  if (identity.provider === 'gmail') return sendWithGmail(userClient, identity, email);
  return sendWithMicrosoft(userClient, identity, email);
}

async function loadAccountSecret(userClient: ReturnType<typeof createClient>, identity: SenderIdentity) {
  if (!identity.accountId) throw new Error('Connected email account was not found.');
  const { data, error } = await userClient.rpc('get_email_account_for_sending', { target_account_id: identity.accountId });
  if (error) throw new Error(error.message);
  const account = (data as EmailAccountSecret[] | null)?.[0];
  if (!account?.access_token) throw new Error('Reconnect this email account before sending.');
  return account;
}

async function getUsableAccessToken(userClient: ReturnType<typeof createClient>, account: EmailAccountSecret) {
  const expiresAt = account.token_expiry ? new Date(account.token_expiry).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return account.access_token as string;
  if (!account.refresh_token) throw new Error('Reconnect this email account before sending.');

  const refreshed = account.provider === 'gmail'
    ? await refreshGoogleToken(account.refresh_token)
    : await refreshMicrosoftToken(account.refresh_token);

  await userClient.rpc('update_email_account_access_token', {
    target_account_id: account.id,
    new_access_token: refreshed.access_token,
    new_token_expiry: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString(),
  });
  return refreshed.access_token;
}

async function sendWithGmail(userClient: ReturnType<typeof createClient>, identity: SenderIdentity, email: { to: string; cc: string[]; bcc: string[]; subject: string; text: string }) {
  const account = await loadAccountSecret(userClient, identity);
  const accessToken = await getUsableAccessToken(userClient, account);
  const raw = encodeBase64Url(buildMimeMessage({ from: formatSender(identity), replyTo: identity.replyTo, to: email.to, cc: email.cc, bcc: email.bcc, subject: email.subject, text: email.text }));
  const response = await fetchWithRetry('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(result?.error?.message || 'Gmail could not send the email.'));
  return { messageId: result?.id as string | undefined };
}

async function sendWithMicrosoft(userClient: ReturnType<typeof createClient>, identity: SenderIdentity, email: { to: string; cc: string[]; bcc: string[]; subject: string; text: string }) {
  const account = await loadAccountSecret(userClient, identity);
  const accessToken = await getUsableAccessToken(userClient, account);
  const response = await fetchWithRetry('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: email.subject,
        body: { contentType: 'Text', content: email.text },
        toRecipients: [recipient(email.to)],
        ccRecipients: email.cc.map(recipient),
        bccRecipients: email.bcc.map(recipient),
        replyTo: identity.replyTo ? [recipient(identity.replyTo)] : [],
      },
      saveToSentItems: true,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(String(result?.error?.message || 'Microsoft 365 could not send the email.'));
  }
  return { messageId: crypto.randomUUID() };
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await delay(350 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      await delay(350 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Email provider did not respond.');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recipient(address: string) {
  return { emailAddress: { address } };
}

async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.error || 'Could not refresh Gmail connection.');
  return result as { access_token: string; expires_in?: number };
}

async function refreshMicrosoftToken(refreshToken: string) {
  const tenant = Deno.env.get('MICROSOFT_OAUTH_TENANT') || Deno.env.get('MICROSOFT_TENANT_ID') || 'common';
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('MICROSOFT_OAUTH_CLIENT_ID'),
      client_secret: requiredEnv('MICROSOFT_OAUTH_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.error || 'Could not refresh Microsoft connection.');
  return result as { access_token: string; expires_in?: number };
}

function buildMimeMessage({ from, replyTo, to, cc, bcc, subject, text }: { from: string; replyTo?: string | null; to: string; cc: string[]; bcc: string[]; subject: string; text: string }) {
  const headers = [
    `From: ${from}`,
    replyTo ? `Reply-To: ${replyTo}` : '',
    `To: ${to}`,
    cc.length ? `Cc: ${cc.join(', ')}` : '',
    bcc.length ? `Bcc: ${bcc.join(', ')}` : '',
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ].filter(Boolean);
  return `${headers.join('\r\n')}\r\n\r\n${text}`;
}

function encodeMimeHeader(value: string) {
  return /[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(value)))}?=` : value;
}

function encodeBase64Url(value: string) {
  return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function logIntegrationEvent(adminClient: ReturnType<typeof createClient>, input: { workspaceId: string; userId?: string | null; accountId?: string | null; provider: string; eventType: string; status: 'ok' | 'error'; metadata?: Record<string, unknown> }) {
  const { error } = await adminClient.from('email_integration_events').insert({
    workspace_id: input.workspaceId,
    user_id: input.userId ?? null,
    account_id: input.accountId ?? null,
    provider: input.provider,
    event_type: input.eventType,
    status: input.status,
    metadata: input.metadata ?? {},
  });
  if (error) console.warn('email integration audit failed', error.message);
}

function formatSender(identity: SenderIdentity) {
  const displayName = identity.displayName || 'TriCord';
  if (identity.sender.includes('<')) return identity.sender;
  return `${formatDisplayName(displayName)} <${identity.sender}>`;
}

function formatDisplayName(value: string) {
  const cleaned = value.replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'TriCord';
  if (/[^\x20-\x7E]/.test(cleaned)) return encodeMimeHeader(cleaned);
  return `"${cleaned.replace(/["\\]/g, '\\$&')}"`;
}

function normalizeEmail(value: string) {
  const email = value.trim().replace(/^mailto:/i, '').replace(/[<>,;]+$/g, '').replace(/^[<,;]+/g, '');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function sanitizeSubject(value: string) {
  return String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function friendlyEmailError(value: string) {
  if (/Gmail/.test(value)) return value;
  if (/Microsoft/.test(value)) return value;
  return value || 'Email could not be sent. Please try again.';
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
