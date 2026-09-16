import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://zyntrastudio.lk', 'https://www.zyntrastudio.lk', 'http://localhost:5500', 'http://127.0.0.1:5500']);
const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
const idPattern = /^[A-Z0-9-]{5,24}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(origin: string) { return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Vary': 'Origin' }; }
function reply(origin: string, status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }
function normalize(value: unknown) { return typeof value === 'string' ? value.trim().toUpperCase() : ''; }

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
  const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userResult = await caller.auth.getUser(authorization.slice(7));
  if (userResult.error || !userResult.data.user) return reply(origin, 401, { success: false, error: 'Invalid or expired session.' });
  const adminProfile = await admin.from('profiles').select('role,active').eq('id', userResult.data.user.id).maybeSingle();
  if (adminProfile.error || adminProfile.data?.role !== 'admin' || adminProfile.data?.active !== true) return reply(origin, 403, { success: false, error: 'Active administrator access is required.' });

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch (_error) { return reply(origin, 400, { success: false, error: 'Invalid request.' }); }
  const action = typeof input.action === 'string' ? input.action : '';
  if (action === 'list') {
    const ids = Array.isArray(input.userIds) ? input.userIds.filter((id): id is string => typeof id === 'string' && uuidPattern.test(id)).slice(0, 250) : [];
    if (!ids.length) return reply(origin, 200, { success: true, mappings: [] });
    const result = await admin.from('client_login_ids').select('user_id,login_id,active').in('user_id', ids);
    if (result.error) return reply(origin, 500, { success: false, error: 'Client IDs could not be loaded.' });
    return reply(origin, 200, { success: true, mappings: result.data || [] });
  }

  const userId = typeof input.userId === 'string' ? input.userId : '';
  if (!uuidPattern.test(userId)) return reply(origin, 400, { success: false, error: 'A valid client is required.' });
  const target = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (target.error || target.data?.role !== 'client') return reply(origin, 404, { success: false, error: 'Client account unavailable.' });

  if (action === 'set') {
    const loginId = normalize(input.loginId);
    if (!idPattern.test(loginId) || reservedIds.has(loginId)) return reply(origin, 400, { success: false, error: 'Use 5–24 letters, numbers or hyphens and avoid reserved names.' });
    const result = await admin.from('client_login_ids').upsert({ user_id: userId, login_id: loginId, active: true }, { onConflict: 'user_id' }).select('user_id,login_id,active').single();
    if (result.error) {
      const unavailable = result.error.code === '23505' || /unique|duplicate/i.test(result.error.message || '');
      return reply(origin, unavailable ? 409 : 500, { success: false, error: unavailable ? 'That Client ID is unavailable.' : 'The Client ID could not be saved.' });
    }
    return reply(origin, 200, { success: true, mapping: result.data });
  }
  if (action === 'disable' || action === 'reactivate') {
    const result = await admin.from('client_login_ids').update({ active: action === 'reactivate' }).eq('user_id', userId).select('user_id,login_id,active').maybeSingle();
    if (result.error || !result.data) return reply(origin, 404, { success: false, error: 'Client ID unavailable.' });
    return reply(origin, 200, { success: true, mapping: result.data });
  }
  return reply(origin, 400, { success: false, error: 'Unsupported action.' });
});
