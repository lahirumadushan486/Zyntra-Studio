import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://zyntrastudio.lk', 'https://www.zyntrastudio.lk', 'http://localhost:5500', 'http://127.0.0.1:5500']);
const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
const idPattern = /^[A-Z0-9-]{5,24}$/;
function cors(origin: string) { return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Vary': 'Origin' }; }
function reply(origin: string, status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }
function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
async function hash(value: string) { const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(data)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins.has(origin)) return reply('https://zyntrastudio.lk', 403, { success: false, error: 'Request not allowed.' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (request.method !== 'POST') return reply(origin, 405, { success: false, error: 'Method not allowed.' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return reply(origin, 415, { success: false, error: 'JSON content is required.' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey || !turnstileSecret) return reply(origin, 503, { success: false, error: 'Registration is not configured.' });

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch (_error) { return reply(origin, 400, { success: false, error: 'Invalid request.' }); }
  const email = clean(input.email, 254).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  const fullName = clean(input.fullName, 120);
  const businessName = clean(input.businessName, 160);
  const phone = clean(input.phone, 40);
  const loginId = clean(input.clientId, 24).toUpperCase();
  const captchaToken = clean(input.captchaToken, 4096);
  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128 || !captchaToken) return reply(origin, 400, { success: false, error: 'Check the registration details and try again.' });
  if (loginId && (!idPattern.test(loginId) || reservedIds.has(loginId))) return reply(origin, 400, { success: false, error: 'Use 5–24 letters, numbers or hyphens and avoid reserved names.' });

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const keyHash = await hash(`${ip}|register|${email}`);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const rate = await admin.from('client_login_rate_limits').select('*').eq('key_hash', keyHash).maybeSingle();
  if (rate.error) return reply(origin, 503, { success: false, error: 'Registration is temporarily unavailable.' });
  const inWindow = rate.data && now.getTime() - new Date(rate.data.window_started_at).getTime() < 60 * 60 * 1000;
  if (inWindow && Number(rate.data.attempt_count) >= 5) return reply(origin, 429, { success: false, error: 'Too many attempts. Please wait and try again.' });

  const verificationBody = new URLSearchParams({ secret: turnstileSecret, response: captchaToken });
  if (ip !== 'unknown') verificationBody.set('remoteip', ip);
  let verified = false;
  try { const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: verificationBody }); const body = await verification.json(); verified = verification.ok && body.success === true; } catch (_error) {}
  if (!verified) return reply(origin, 400, { success: false, error: 'Security verification failed. Please try again.' });

  await admin.from('client_login_rate_limits').upsert({ key_hash: keyHash, attempt_count: inWindow ? Number(rate.data.attempt_count) + 1 : 1, window_started_at: inWindow ? rate.data.window_started_at : now.toISOString(), blocked_until: null, updated_at: now.toISOString() });
  const signup = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await signup.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://zyntrastudio.lk/portal/login',
      data: { full_name: fullName, business_name: businessName || null, phone: phone || null, requested_client_id: loginId || null }
    }
  });
  if (result.error || !result.data.user || (Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0)) {
    const idUnavailable = Boolean(loginId) && /database|duplicate|unique|client id/i.test(result.error?.message || '');
    return reply(origin, 409, { success: false, error: idUnavailable ? 'That Client ID is unavailable.' : 'Registration could not be completed. The email may already be registered.' });
  }
  await admin.from('client_login_rate_limits').delete().eq('key_hash', keyHash);
  const session = result.data.session;
  return reply(origin, 200, { success: true, confirmationRequired: !session, session: session ? { access_token: session.access_token, refresh_token: session.refresh_token } : null });
});
