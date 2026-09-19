import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://zyntrastudio.lk',
  'https://www.zyntrastudio.lk',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);
const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
const idPattern = /^[A-Z0-9-]{5,24}$/;

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : 'https://zyntrastudio.lk';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function response(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });
}

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return response(origin, 405, { success: false, error: 'Method not allowed.' });
  if (!origin || !allowedOrigins.has(origin)) return response(origin, 403, { success: false, error: 'Origin not allowed.' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return response(origin, 415, { success: false, error: 'JSON content is required.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith('Bearer ')) {
    return response(origin, 401, { success: false, error: 'Authentication required.' });
  }

  const token = authorization.slice('Bearer '.length);
  const callerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const userResult = await callerClient.auth.getUser(token);
  if (userResult.error || !userResult.data.user) return response(origin, 401, { success: false, error: 'Invalid or expired session.' });

  const profileResult = await adminClient.from('profiles').select('id,role,active').eq('id', userResult.data.user.id).single();
  const callerRole = String(profileResult.data?.role || '').trim().toLowerCase();
  if (profileResult.error || callerRole !== 'admin' || profileResult.data?.active !== true) {
    return response(origin, 403, { success: false, error: 'Active administrator access is required.' });
  }

  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch (_error) { return response(origin, 400, { success: false, error: 'Invalid request body.' }); }

  const email = clean(input.email, 254).toLowerCase();
  const fullName = clean(input.full_name, 120);
  const businessName = clean(input.business_name, 160);
  const phone = clean(input.phone, 40);
  const clientLoginId = clean(input.client_login_id, 24).toUpperCase();
  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response(origin, 400, { success: false, error: 'Valid client name and email are required.' });
  }
  if (clientLoginId && (!idPattern.test(clientLoginId) || reservedIds.has(clientLoginId))) {
    return response(origin, 400, { success: false, error: 'Use 5–24 letters, numbers or hyphens and avoid reserved names.' });
  }
  let existingAuthUser = null;
  for (let page = 1; page <= 10 && !existingAuthUser; page += 1) {
    const users = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (users.error) return response(origin, 500, { success: false, error: 'The existing Auth account could not be checked.' });
    existingAuthUser = users.data.users.find((user) => String(user.email || '').toLowerCase() === email) || null;
    if (users.data.users.length < 1000) break;
  }

  async function prepareClient(user: { id: string; email_confirmed_at?: string | null }, invitationSent: boolean) {
    const existingProfile = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (existingProfile.error) return response(origin, 500, { success: false, error: invitationSent ? 'The invitation was sent, but the client profile could not be verified. Retry to repair it; no new invitation will be sent.' : 'The client profile could not be verified.' });
    if (String(existingProfile.data?.role || '').trim().toLowerCase() === 'admin') return response(origin, 409, { success: false, error: 'An administrator account cannot be replaced.' });

    if (clientLoginId) {
      const existingId = await adminClient.from('client_login_ids').select('user_id').eq('login_id', clientLoginId).maybeSingle();
      if (existingId.error) return response(origin, 500, { success: false, error: 'The Client ID could not be verified.' });
      if (existingId.data && existingId.data.user_id !== user.id) return response(origin, 409, { success: false, error: 'That Client ID is unavailable.' });
    }

    const safeProfile = { full_name: fullName, business_name: businessName || null, phone: phone || null, active: true };
    const profileWrite = existingProfile.data
      ? await adminClient.from('profiles').update(safeProfile).eq('id', user.id).eq('role', 'client').select('id,role').single()
      : await adminClient.from('profiles').insert({ id: user.id, ...safeProfile, role: 'client' }).select('id,role').single();
    if (profileWrite.error || profileWrite.data?.role !== 'client') return response(origin, 500, { success: false, error: invitationSent ? 'The invitation was sent, but the client profile could not be prepared. Retry to repair it; no new invitation will be sent.' : 'The client profile could not be prepared.' });

    if (clientLoginId) {
      const mapping = await adminClient.from('client_login_ids').upsert({ user_id: user.id, login_id: clientLoginId, active: Boolean(user.email_confirmed_at) }, { onConflict: 'user_id' });
      if (mapping.error) return response(origin, 500, { success: false, error: invitationSent ? 'The invitation was sent and the profile exists, but the Client ID could not be saved. Retry to repair it; no new invitation will be sent.' : 'The profile exists, but the Client ID could not be saved.' });
    }
    return response(origin, 200, { success: true, userId: user.id, invitationSent, repaired: !invitationSent });
  }

  if (existingAuthUser) return prepareClient(existingAuthUser, false);

  if (clientLoginId) {
    const existingId = await adminClient.from('client_login_ids').select('user_id').eq('login_id', clientLoginId).maybeSingle();
    if (existingId.error) return response(origin, 500, { success: false, error: 'The Client ID could not be verified.' });
    if (existingId.data) return response(origin, 409, { success: false, error: 'That Client ID is unavailable.' });
  }

  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://zyntrastudio.lk/portal/login',
    data: { full_name: fullName, business_name: businessName || null, phone: phone || null, requested_client_id: clientLoginId || null }
  });
  if (inviteResult.error || !inviteResult.data.user) {
    const idUnavailable = Boolean(clientLoginId) && /database|duplicate|unique|client id/i.test(inviteResult.error?.message || '');
    return response(origin, idUnavailable ? 409 : 500, { success: false, error: idUnavailable ? 'That Client ID is unavailable.' : 'The client invitation could not be sent.' });
  }
  return prepareClient(inviteResult.data.user, true);
});
