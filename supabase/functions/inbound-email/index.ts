import { createClient } from 'npm:@supabase/supabase-js@2';
import { Webhook } from 'npm:svix';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type, svix-id, svix-signature, svix-timestamp, x-client-info',
};

interface InboundEmailPayload {
  to?: string | string[];
  recipients?: string | string[];
  recipient?: string | string[];
  received_for?: string | string[];
  receivedFor?: string | string[];
  deliveredTo?: string | string[];
  delivered_to?: string | string[];
  from?: string;
  sender?: string;
  subject?: string;
  id?: string;
  emailId?: string;
  email_id?: string;
  text?: string;
  html?: string;
  plain?: string;
  textPlain?: string;
  text_plain?: string;
  plainText?: string;
  plain_text?: string;
  bodyPlain?: string;
  body_plain?: string;
  htmlBody?: string;
  html_body?: string;
  textBody?: string;
  text_body?: string;
  body?: string | { text?: string; html?: string; plain?: string };
  content?: string;
  email?: unknown;
  message?: unknown;
  envelope?: unknown;
  headers?: unknown;
  messageId?: string;
  message_id?: string;
  providerMessageId?: string;
  provider_message_id?: string;
  inReplyTo?: string;
  in_reply_to?: string;
  references?: string | string[];
  replyTo?: string;
  reply_to?: string;
  raw?: string;
  attachments?: Array<{ filename?: string; contentType?: string; size?: number; url?: string }>;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const rawPayload = await request.text();
    const payload = verifyResendWebhook(rawPayload, request.headers);
    const recipients = getInboundRecipients(payload);
    const alias = recipients.map(extractLocalPart).find(Boolean);
    if (!alias) return json({ error: 'No Room forwarding address found.' }, 400);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: room, error: roomError } = await adminClient
      .from('spaces')
      .select('id, workspace_id, name, email_forwarding_enabled, workspaces(owner_id)')
      .eq('email_alias', alias)
      .maybeSingle();
    if (roomError) throw new Error(roomError.message);
    if (!room) return json({ error: 'Room forwarding address not found.' }, 404);
    if (room.email_forwarding_enabled === false) return json({ error: 'Email forwarding is disabled for this Room.' }, 403);

    const ownerId = Array.isArray(room.workspaces) ? room.workspaces[0]?.owner_id : room.workspaces?.owner_id;
    if (!ownerId) return json({ error: 'Hub owner not found.' }, 404);

    const fetchResult = getInboundEmailBody(payload) ? { payload: null, diagnostics: [] as FetchDiagnostic[] } : await fetchResendEmailPayload(payload);
    const emailPayload = fetchResult.payload ? { ...payload, ...fetchResult.payload } : payload;
    const subject = sanitizeText(emailPayload.subject || 'Forwarded email', 180);
    const sender = sanitizeText(emailPayload.from || emailPayload.sender || 'Unknown sender', 200);
    const bodyText = sanitizeEmailBody(stripHtml(getInboundEmailBody(emailPayload)), 20000);
    const attachments = Array.isArray(emailPayload.attachments) ? emailPayload.attachments.slice(0, 10) : [];
    const attachmentSummary = attachments.length
      ? '\n\nAttachments:\n' + attachments.map((attachment) => '- ' + sanitizeText(attachment.filename || 'attachment', 160) + (attachment.size ? ' (' + attachment.size + ' bytes)' : '')).join('\n')
      : '';

    const providerMessageId = emailPayload.providerMessageId || emailPayload.provider_message_id || emailPayload.messageId || emailPayload.message_id || emailPayload.emailId || emailPayload.email_id || emailPayload.id || null;
    const inboundMetadata = {
      source: 'inbound_email',
      inbound_alias: alias,
      sender,
      recipients,
      subject_key: normalizeSubjectKey(subject),
      provider_message_id: providerMessageId,
      in_reply_to: emailPayload.inReplyTo || emailPayload.in_reply_to || null,
      references: emailPayload.references || null,
      reply_to: emailPayload.replyTo || emailPayload.reply_to || null,
      body_detected: Boolean(bodyText),
      body_keys: getPayloadBodyKeyHints(emailPayload),
      fetch_diagnostics: fetchResult.diagnostics,
      attachments,
    };
    const postBody = ['Forwarded from: ' + sender, '', bodyText || 'No email body was provided.', attachmentSummary].join('\n').trim();
    const existingPost = await findExistingEmailPost(adminClient, room.workspace_id, room.id, subject);

    if (existingPost) {
      const commentBody = ['Forwarded from: ' + sender, '', bodyText || 'No email body was provided.', attachmentSummary].join('\n').trim();
      const { error: commentError } = await adminClient.from('comments').insert({
        workspace_id: room.workspace_id,
        post_id: existingPost.id,
        author_id: ownerId,
        body: commentBody,
        metadata: inboundMetadata,
      });
      if (commentError) throw new Error(commentError.message);
      await adminClient.from('posts').update({ last_activity_at: new Date().toISOString() }).eq('id', existingPost.id);
      return json({ ok: true, postId: existingPost.id, appended: true });
    }

    const { data: post, error: postError } = await adminClient
      .from('posts')
      .insert({
        workspace_id: room.workspace_id,
        space_id: room.id,
        author_id: ownerId,
        title: subject,
        body: postBody,
        metadata: inboundMetadata,
      })
      .select('id')
      .single();
    if (postError) throw new Error(postError.message);

    return json({ ok: true, postId: post.id, appended: false });
  } catch (error) {
    if (error instanceof UnauthorizedError) return json({ error: 'Unauthorized.' }, 401);
    if (error instanceof ConfigurationError) return json({ error: error.message }, 503);
    return json({ error: error instanceof Error ? error.message : 'Inbound email could not be processed.' }, 400);
  }
});

function verifyResendWebhook(rawPayload: string, headers: Headers): InboundEmailPayload {
  const signingSecret = Deno.env.get('RESEND_WEBHOOK_SIGNING_SECRET');
  if (!signingSecret) throw new ConfigurationError('Inbound email webhook signing is not configured.');
  try {
    const webhook = new Webhook(signingSecret);
    const verifiedPayload = webhook.verify(rawPayload, {
      'svix-id': headers.get('svix-id') ?? '',
      'svix-timestamp': headers.get('svix-timestamp') ?? '',
      'svix-signature': headers.get('svix-signature') ?? '',
    }) as unknown;
    return normalizeInboundPayload(verifiedPayload);
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new UnauthorizedError('Invalid webhook signature.');
  }
}

function normalizeInboundPayload(value: unknown): InboundEmailPayload {
  if (!isRecord(value)) return {};
  const data = isRecord(value.data) ? value.data : value;
  if (isRecord(data.payload)) return normalizeInboundPayload({ ...data, ...data.payload });
  if (isRecord(data.record)) return normalizeInboundPayload({ ...data, ...data.record });
  if (isRecord(data.email)) return { ...data, ...data.email } as unknown as InboundEmailPayload;
  if (isRecord(data.message)) return { ...data, ...data.message } as unknown as InboundEmailPayload;
  return data as unknown as InboundEmailPayload;
}

interface FetchDiagnostic {
  endpoint: string;
  status: number | string;
  message?: string;
}

async function fetchResendEmailPayload(payload: InboundEmailPayload): Promise<{ payload: InboundEmailPayload | null; diagnostics: FetchDiagnostic[] }> {
  const emailId = getResendEmailId(payload);
  const apiKey = Deno.env.get('RESEND_INBOUND_API_KEY') || Deno.env.get('RESEND_API_KEY');
  const diagnostics: FetchDiagnostic[] = [];
  if (!emailId) return { payload: null, diagnostics: [{ endpoint: 'resend', status: 'skipped', message: 'No Resend email id was present in the webhook payload.' }] };
  if (!apiKey) return { payload: null, diagnostics: [{ endpoint: 'resend', status: 'skipped', message: 'RESEND_INBOUND_API_KEY or RESEND_API_KEY is not configured.' }] };
  const encodedId = encodeURIComponent(emailId);
  const paths = [
    `https://api.resend.com/emails/receiving/${encodedId}`,
    `https://api.resend.com/emails/receiving/${encodedId}/raw`,
    `https://api.resend.com/inbound/emails/${encodedId}`,
    `https://api.resend.com/inbound/emails/${encodedId}/raw`,
    `https://api.resend.com/emails/${encodedId}`,
    `https://api.resend.com/emails/${encodedId}/raw`,
  ];
  for (const path of paths) {
    try {
      const response = await fetch(path, { headers: { Authorization: `Bearer ${apiKey}` } });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok) {
        const message = await safeResponseMessage(response);
        diagnostics.push({ endpoint: redactEmailEndpoint(path), status: response.status, message });
        continue;
      }
      if (contentType.includes('application/json')) return { payload: normalizeInboundPayload(await response.json()), diagnostics };
      const raw = await response.text();
      if (raw.trim()) return { payload: { raw }, diagnostics };
      diagnostics.push({ endpoint: redactEmailEndpoint(path), status: response.status, message: 'Empty response body.' });
    } catch (error) {
      diagnostics.push({ endpoint: redactEmailEndpoint(path), status: 'error', message: error instanceof Error ? error.message : 'Fetch failed.' });
    }
  }
  return { payload: null, diagnostics };
}

function getResendEmailId(payload: InboundEmailPayload) {
  const id = firstNonEmptyString(
    payload.emailId,
    payload.email_id,
    payload.id,
    findDeepStringByKey(payload, ['emailId', 'email_id', 'resendEmailId', 'resend_email_id', 'id']),
  );
  return id && !id.includes('@') && !id.includes('<') ? id : '';
}

async function safeResponseMessage(response: Response) {
  try {
    const text = await response.text();
    return text.replace(/\s+/g, ' ').slice(0, 240);
  } catch (_) {
    return response.statusText || 'Request failed.';
  }
}

function redactEmailEndpoint(path: string) {
  return path.replace(/\/([A-Za-z0-9_-]{8,})(?=\/?$)/, '/:id');
}

function getInboundEmailBody(payload: InboundEmailPayload) {
  const body = payload.body;
  if (isRecord(body)) {
    const nestedBody = firstNonEmptyString(body.text, body.plain, body.textPlain, body.text_plain, body.plainText, body.plain_text, body.html, body.htmlBody, body.html_body, body.content);
    if (nestedBody) return nestedBody;
  }
  const directBody = firstNonEmptyString(
    payload.text,
    payload.plain,
    payload.textPlain,
    payload.text_plain,
    payload.plainText,
    payload.plain_text,
    payload.bodyPlain,
    payload.body_plain,
    payload.textBody,
    payload.text_body,
    typeof body === 'string' ? body : '',
    payload.content,
    payload.html,
    payload.htmlBody,
    payload.html_body,
  );
  if (directBody) return directBody;
  return firstNonEmptyString(
    findDeepStringByKey(payload, ['text', 'plain', 'textPlain', 'text_plain', 'plainText', 'plain_text', 'bodyPlain', 'body_plain', 'textBody', 'text_body', 'html', 'htmlBody', 'html_body', 'content']),
    extractRawEmailBody(payload.raw),
  );
}

async function findExistingEmailPost(adminClient: ReturnType<typeof createClient>, workspaceId: string, roomId: string, subject: string) {
  const subjectKey = normalizeSubjectKey(subject);
  if (!subjectKey) return null;
  const { data, error } = await adminClient
    .from('posts')
    .select('id, title, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .eq('space_id', roomId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).find((post) => normalizeSubjectKey(String(post.title || '')) === subjectKey || normalizeSubjectKey(String((post.metadata as Record<string, unknown> | null)?.subject_key || '')) === subjectKey) ?? null;
}

function normalizeSubjectKey(subject: string) {
  return sanitizeText(subject || '', 240)
    .replace(/^\s*(re|fw|fwd)\s*:\s*/i, '')
    .replace(/^\s*(re|fw|fwd)\s*:\s*/i, '')
    .toLowerCase();
}

function findDeepStringByKey(value: unknown, keys: string[], seen = new Set<unknown>()): string {
  if (!isRecord(value) && !Array.isArray(value)) return '';
  if (seen.has(value)) return '';
  seen.add(value);
  if (isRecord(value)) {
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    for (const nested of Object.values(value)) {
      const found = findDeepStringByKey(nested, keys, seen);
      if (found) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const nested of value) {
      const found = findDeepStringByKey(nested, keys, seen);
      if (found) return found;
    }
  }
  return '';
}

function getPayloadBodyKeyHints(payload: InboundEmailPayload) {
  const hints = new Set<string>();
  collectBodyKeyHints(payload, hints);
  return [...hints].slice(0, 24);
}

function collectBodyKeyHints(value: unknown, hints: Set<string>, path = '', seen = new Set<unknown>()) {
  if (!isRecord(value) && !Array.isArray(value)) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (/body|text|html|plain|content|raw/i.test(key)) hints.add(nextPath);
      collectBodyKeyHints(nested, hints, nextPath, seen);
    }
  } else {
    value.forEach((nested, index) => collectBodyKeyHints(nested, hints, `${path}[${index}]`, seen));
  }
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

class UnauthorizedError extends Error {}
class ConfigurationError extends Error {}

function getInboundRecipients(payload: InboundEmailPayload) {
  const recipients = [
    ...normalizeRecipients(payload.to),
    ...normalizeRecipients(payload.recipients),
    ...normalizeRecipients(payload.recipient),
    ...normalizeRecipients(payload.received_for),
    ...normalizeRecipients(payload.receivedFor),
    ...normalizeRecipients(payload.deliveredTo),
    ...normalizeRecipients(payload.delivered_to),
    ...normalizeRecipients(findDeepStringByKey(payload, ['to', 'recipients', 'recipient', 'received_for', 'receivedFor', 'deliveredTo', 'delivered_to'])),
  ];
  return [...new Set(recipients.map((recipient) => recipient.trim()).filter(Boolean))];
}

function normalizeRecipients(value: unknown) {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeRecipients(item));
  if (typeof value === 'string') return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  if (isRecord(value)) {
    const direct = firstNonEmptyString(value.email, value.address, value.recipient, value.to);
    if (direct) return normalizeRecipients(direct);
  }
  return [];
}

function extractLocalPart(value: string) {
  const match = value.match(/<?([^<>\s@]+)@[^<>\s]+>?/);
  return match?.[1]?.toLowerCase() ?? '';
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>(?![^<]*>)/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeText(value: string, maxLength: number) {
  return String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeEmailBody(value: string, maxLength: number) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function extractRawEmailBody(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  let raw = value;
  try {
    raw = atob(value);
  } catch (_) {
    raw = value;
  }
  const preferred = extractMimePart(raw, 'text/plain') || extractMimePart(raw, 'text/html');
  if (preferred) return preferred;
  const parts = raw.split(/\r?\n\r?\n/);
  return parts.length > 1 ? decodeTransferBody(parts.slice(1).join('\n\n'), raw) : '';
}

function extractMimePart(raw: string, mimeType: string) {
  const sections = raw.split(/\r?\n--[^\r\n]+/g);
  for (const section of sections) {
    if (!new RegExp(`content-type:\\s*${mimeType.replace('/', '\\/')}`, 'i').test(section)) continue;
    const [, ...bodyParts] = section.split(/\r?\n\r?\n/);
    const body = bodyParts.join('\n\n').trim();
    if (body) return decodeTransferBody(body, section);
  }
  return '';
}

function decodeTransferBody(body: string, headers: string) {
  if (/content-transfer-encoding:\s*base64/i.test(headers)) {
    try { return atob(body.replace(/\s+/g, '')); } catch (_) { return body; }
  }
  if (/content-transfer-encoding:\s*quoted-printable/i.test(headers)) return decodeQuotedPrintable(body);
  return body;
}

function decodeQuotedPrintable(value: string) {
  const softLineBreaksRemoved = value.replace(/=\r?\n/g, '');
  return softLineBreaksRemoved.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(name + ' is not configured.');
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
