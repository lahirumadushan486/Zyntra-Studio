import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://zyntrastudio.lk',
  'https://www.zyntrastudio.lk',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);
const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
const idPattern = /^[A-Z0-9-]{5,24}$/;
const windowMs = 15 * 60 * 1000;
const maxAttempts = 5;

function headers(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function reply(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(origin), 'Content-Type': 'application/json' } });
}

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins.has(origin)) return reply('https://zyntrastudio.lk', 403, { success: false, error: 'Request not allowed.' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers(origin) });
  if (request.method !== 'POST') return reply(origin, 405, { success: false, error: 'Method not allowed.' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return reply(origin, 415, { success: false, error: 'JSON content is required.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !turnstileSecret) {
    return reply(origin, 503, { success: false, error: 'Client ID login is not configured.' });
  }

  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch (_error) { return reply(origin, 400, { success: false, error: 'Invalid request.' }); }
  const loginId = normalize(input.loginId);
  const password = typeof input.password === 'string' ? input.password : '';
  const captchaToken = typeof input.captchaToken === 'string' ? input.captchaToken.trim() : '';
  if (!idPattern.test(loginId) || reservedIds.has(loginId) || password.length < 8 || password.length > 128 || !captchaToken) {
    return reply(origin, 401, { success: false, error: 'The email, Client ID or password is incorrect.' });
  }

  const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const keyHashes = await Promise.all([sha256(`ip:${forwarded}`), sha256(`id:${loginId}`)]);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const rateResult = await admin.from('client_login_rate_limits').select('*').in('key_hash', keyHashes);
  if (rateResult.error) return reply(origin, 503, { success: false, error: 'Sign in is temporarily unavailable.' });
  const rates = new Map((rateResult.data || []).map((item) => [item.key_hash, item]));
  if ((rateResult.data || []).some((item) => item.blocked_until && new Date(item.blocked_until).getTime() > now.getTime())) {
    return reply(origin, 429, { success: false, error: 'Too many attempts. Please wait and try again.' });
  }

  async function recordFailure() {
    await Promise.all(keyHashes.map(async (keyHash) => {
      const rate = rates.get(keyHash);
      const inWindow = rate && now.getTime() - new Date(rate.window_started_at).getTime() < windowMs;
      const attemptCount = inWindow ? Number(rate.attempt_count || 0) + 1 : 1;
      await admin.from('client_login_rate_limits').upsert({
        key_hash: keyHash,
        attempt_count: attemptCount,
        window_started_at: inWindow ? rate.window_started_at : now.toISOString(),
        blocked_until: attemptCount >= maxAttempts ? new Date(now.getTime() + windowMs).toISOString() : null,
        updated_at: now.toISOString()
      });
    }));
  }

  const verifyBody = new URLSearchParams({ secret: turnstileSecret, response: captchaToken });
  if (forwarded !== 'unknown') verifyBody.set('remoteip', forwarded);
  let captchaValid = false;
  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: verifyBody });
    const result = await verification.json();
    captchaValid = verification.ok && result.success === true;
  } catch (_error) { /* fail closed */ }
  if (!captchaValid) {
    await recordFailure();
    return reply(origin, 401, { success: false, error: 'The email, Client ID or password is incorrect.' });
  }

  const mapping = await admin.from('client_login_ids').select('user_id,active').eq('login_id', loginId).maybeSingle();
  if (mapping.error || !mapping.data || mapping.data.active !== true) {
    await recordFailure();
    return reply(origin, 401, { success: false, error: 'The email, Client ID or password is incorrect.' });
  }
  const profile = await admin.from('profiles').select('role,active').eq('id', mapping.data.user_id).maybeSingle();
  if (profile.error || profile.data?.role !== 'client' || profile.data?.active !== true) {
    await recordFailure();
    return reply(origin, 401, { success: false, error: 'The email, Client ID or password is incorrect.' });
  }
  const user = await admin.auth.admin.getUserById(mapping.data.user_id);
  const email = user.data.user?.email;
  if (user.error || !email) {
    await recordFailure();
    return reply(origin, 401, { success: false, error: 'The email, Client ID or password is incorrect.' });
  }

  const passwordClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await passwordClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    await recordFailure();
    return reply(origin, 401, { success: false, error: 'The email, Client ID or password is incorrect.' });
  }

  await admin.from('client_login_rate_limits').delete().in('key_hash', keyHashes);
  const session = signedIn.data.session;
  return reply(origin, 200, {
    success: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type
    }
  });
});
