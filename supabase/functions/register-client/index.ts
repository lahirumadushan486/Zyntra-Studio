import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://zyntrastudio.lk', 'https://www.zyntrastudio.lk', 'http://localhost:5500', 'http://127.0.0.1:5500']);
const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
const idPattern = /^[A-Z0-9-]{5,24}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

function cors(origin: string) { return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Vary': 'Origin' }; }
function reply(origin: string, status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }
function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins.has(origin)) return reply('https://zyntrastudio.lk', 403, { success: false, error: 'Request not allowed.' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (request.method !== 'POST') return reply(origin, 405, { success: false, error: 'Method not allowed.' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return reply(origin, 415, { success: false, error: 'JSON content is required.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization?.startsWith('Bearer ')) return reply(origin, 401, { success: false, error: 'Authentication required.' });

  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const callerUser = await caller.auth.getUser();
  if (callerUser.error || !callerUser.data.user) return reply(origin, 401, { success: false, error: 'Your admin session has expired.' });
  const callerProfile = await admin.from('profiles').select('role,active').eq('id', callerUser.data.user.id).maybeSingle();
  if (callerProfile.error || callerProfile.data?.role !== 'admin' || callerProfile.data?.active !== true) return reply(origin, 403, { success: false, error: 'Active administrator access is required.' });

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch (_error) { return reply(origin, 400, { success: false, error: 'Invalid request.' }); }
  const email = clean(input.email, 254).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  const fullName = clean(input.fullName, 120);
  const businessName = clean(input.businessName, 160);
  const phone = clean(input.phone, 40);
  const loginId = clean(input.clientId, 24).toUpperCase();
  if (!fullName || !emailPattern.test(email)) return reply(origin, 400, { success: false, error: 'Valid client name and email are required.' });
  if (!strongPassword.test(password)) return reply(origin, 400, { success: false, error: 'Please enter a stronger password.' });
  if (loginId && (!idPattern.test(loginId) || reservedIds.has(loginId))) return reply(origin, 400, { success: false, error: 'Client ID format is invalid.' });

  if (loginId) {
    const existingId = await admin.from('client_login_ids').select('user_id').eq('login_id', loginId).maybeSingle();
    if (existingId.error) return reply(origin, 500, { success: false, error: 'The Client ID could not be verified.' });
    if (existingId.data) return reply(origin, 409, { success: false, error: 'That Client ID is unavailable.' });
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, business_name: businessName || null, phone: phone || null, requested_client_id: loginId || null, must_change_password: true }
  });
  if (created.error || !created.data.user) {
    const duplicate = /already|registered|exists/i.test(created.error?.message || '');
    return reply(origin, duplicate ? 409 : 500, { success: false, error: duplicate ? 'An account with this email already exists.' : 'The client account could not be created.' });
  }

  const userId = created.data.user.id;
  const profileWrite = await admin.from('profiles').update({ full_name: fullName, business_name: businessName || null, phone: phone || null, role: 'client', active: true, must_change_password: true }).eq('id', userId).eq('role', 'client');
  if (profileWrite.error) {
    await admin.auth.admin.deleteUser(userId);
    return reply(origin, 500, { success: false, error: 'The client profile could not be prepared.' });
  }
  if (loginId) {
    const mapping = await admin.from('client_login_ids').upsert({ user_id: userId, login_id: loginId, active: true }, { onConflict: 'user_id' });
    if (mapping.error) {
      await admin.auth.admin.deleteUser(userId);
      const unavailable = /duplicate|unique/i.test(mapping.error.message || '');
      return reply(origin, unavailable ? 409 : 500, { success: false, error: unavailable ? 'That Client ID is unavailable.' : 'The Client ID could not be saved.' });
    }
  }
  await admin.from('portal_activity').insert({ actor_id: callerUser.data.user.id, action: 'Client account created', entity_type: 'client_profile', entity_id: userId, details: 'Direct client registration completed; temporary password change required' });
  return reply(origin, 200, { success: true, userId });
});
