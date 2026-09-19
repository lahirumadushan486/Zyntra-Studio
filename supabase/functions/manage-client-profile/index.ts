import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://zyntrastudio.lk', 'https://www.zyntrastudio.lk', 'http://localhost:5500', 'http://127.0.0.1:5500']);
const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
const idPattern = /^[A-Z0-9-]{5,24}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(origin: string) { return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Vary': 'Origin' }; }
function reply(origin: string, status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }
function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function normalizeId(value: unknown) { return clean(value, 24).toUpperCase(); }
function validId(value: string) { return idPattern.test(value) && !reservedIds.has(value) && !value.includes('@'); }
function combined(profile: Record<string, unknown>, email: string | null, mapping?: Record<string, unknown>) {
  return {
    id: profile.id,
    full_name: profile.full_name,
    business_name: profile.business_name,
    email,
    phone: profile.phone,
    role: profile.role,
    active: profile.active,
    client_id: mapping?.login_id || null,
    client_id_active: mapping?.active ?? null,
    created_at: profile.created_at,
    updated_at: profile.updated_at
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins.has(origin)) return reply('https://zyntrastudio.lk', 403, { success: false, error: 'Request not allowed.' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (request.method !== 'POST') return reply(origin, 405, { success: false, error: 'Method not allowed.' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return reply(origin, 415, { success: false, error: 'JSON content is required.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith('Bearer ')) return reply(origin, 401, { success: false, error: 'Authentication required.' });
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const callerUser = await caller.auth.getUser();
  if (callerUser.error || !callerUser.data.user) return reply(origin, 401, { success: false, error: 'Your admin session has expired.' });
  const callerProfile = await admin.from('profiles').select('role,active').eq('id', callerUser.data.user.id).maybeSingle();
  if (callerProfile.error || callerProfile.data?.role !== 'admin' || callerProfile.data?.active !== true) return reply(origin, 403, { success: false, error: 'You do not have permission to edit this client.' });

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch (_error) { return reply(origin, 400, { success: false, error: 'Invalid request.' }); }
  const action = clean(input.action, 30);

  if (action === 'list') {
    const profiles = await admin.from('profiles').select('id,full_name,business_name,phone,role,active,created_at,updated_at').eq('role', 'client').order('created_at', { ascending: false });
    if (profiles.error) return reply(origin, 500, { success: false, error: 'Clients could not be loaded.' });
    const ids = (profiles.data || []).map((profile) => profile.id);
    const mappings = ids.length ? await admin.from('client_login_ids').select('user_id,login_id,active,created_at,updated_at').in('user_id', ids) : { data: [], error: null };
    if (mappings.error) return reply(origin, 500, { success: false, error: 'Client IDs could not be loaded.' });
    const emails = new Map<string, string>();
    const targetIds = new Set(ids);
    for (let page = 1; page <= 10 && emails.size < ids.length; page += 1) {
      const users = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (users.error) return reply(origin, 500, { success: false, error: 'Client login emails could not be loaded.' });
      users.data.users.forEach((user) => { if (user.email && targetIds.has(user.id)) emails.set(user.id, user.email); });
      if (users.data.users.length < 1000) break;
    }
    const mappingByUser = new Map((mappings.data || []).map((mapping) => [mapping.user_id, mapping]));
    return reply(origin, 200, { success: true, clients: (profiles.data || []).map((profile) => combined(profile, emails.get(profile.id) || null, mappingByUser.get(profile.id))) });
  }

  const userId = clean(input.userId, 36);
  if (!uuidPattern.test(userId)) return reply(origin, 400, { success: false, error: 'A valid client is required.' });
  const target = await admin.from('profiles').select('id,full_name,business_name,phone,role,active,created_at,updated_at').eq('id', userId).maybeSingle();
  if (target.error || target.data?.role !== 'client') return reply(origin, 404, { success: false, error: 'Client profile could not be found.' });

  if (action === 'get') {
    const [mapping, authUser] = await Promise.all([
      admin.from('client_login_ids').select('user_id,login_id,active,created_at,updated_at').eq('user_id', userId).maybeSingle(),
      admin.auth.admin.getUserById(userId)
    ]);
    if (mapping.error || authUser.error) return reply(origin, 500, { success: false, error: 'Client profile could not be loaded.' });
    return reply(origin, 200, { success: true, client: combined(target.data, authUser.data.user?.email || null, mapping.data || undefined) });
  }

  if (action === 'availability') {
    const loginId = normalizeId(input.clientId);
    if (!validId(loginId)) return reply(origin, 200, { success: true, state: 'invalid' });
    const existing = await admin.from('client_login_ids').select('user_id,login_id').eq('login_id', loginId).maybeSingle();
    if (existing.error) return reply(origin, 500, { success: false, error: 'Availability could not be checked.' });
    return reply(origin, 200, { success: true, state: !existing.data ? 'available' : existing.data.user_id === userId ? 'current' : 'unavailable' });
  }

  if (action === 'generate') {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const candidate = 'ZYN-' + Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('');
      const existing = await admin.from('client_login_ids').select('user_id').eq('login_id', candidate).maybeSingle();
      if (!existing.error && !existing.data) return reply(origin, 200, { success: true, clientId: candidate, state: 'available' });
    }
    return reply(origin, 503, { success: false, error: 'A Client ID could not be generated. Please try again.' });
  }

  if (action === 'update') {
    const fullName = clean(input.fullName, 120);
    const businessName = clean(input.businessName, 160);
    const phone = clean(input.phone, 40);
    const loginId = normalizeId(input.clientId);
    if (!fullName) return reply(origin, 400, { success: false, error: 'A valid full name is required.' });
    if (loginId && !validId(loginId)) return reply(origin, 400, { success: false, error: 'Client ID format is invalid.' });
    const updated = await caller.rpc('admin_update_client_profile', {
      target_user_id: userId,
      new_full_name: fullName,
      new_business_name: businessName || null,
      new_phone: phone || null,
      new_client_login_id: loginId || null,
      new_client_id_active: input.clientIdActive !== false,
      new_account_active: input.accountActive !== false
    });
    if (updated.error) {
      const duplicate = updated.error.code === '23505' || /already in use|duplicate|unique/i.test(updated.error.message || '');
      const missing = updated.error.code === 'P0002';
      const forbidden = updated.error.code === '42501';
      return reply(origin, duplicate ? 409 : missing ? 404 : forbidden ? 403 : 400, { success: false, error: duplicate ? 'Client ID is already in use.' : missing ? 'Client profile could not be found.' : forbidden ? 'You do not have permission to edit this client.' : 'The update could not be completed. Please try again.' });
    }
    const [freshProfile, freshMapping, authUser] = await Promise.all([
      admin.from('profiles').select('id,full_name,business_name,phone,role,active,created_at,updated_at').eq('id', userId).single(),
      admin.from('client_login_ids').select('user_id,login_id,active,created_at,updated_at').eq('user_id', userId).maybeSingle(),
      admin.auth.admin.getUserById(userId)
    ]);
    if (freshProfile.error || freshMapping.error) return reply(origin, 500, { success: false, error: 'The profile was updated, but the canonical client record could not be refreshed.' });
    if (authUser.error) return reply(origin, 500, { success: false, error: 'The profile was updated, but its login email could not be refreshed.' });
    return reply(origin, 200, { success: true, client: combined(freshProfile.data, authUser.data.user?.email || null, freshMapping.data || undefined) });
  }

  return reply(origin, 400, { success: false, error: 'Unsupported action.' });
});
