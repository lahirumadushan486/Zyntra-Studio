import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const BUCKET = 'quotation-images';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;
const RATE_WINDOW_MINUTES = 10;
const RATE_LIMIT = 5;
const allowedOrigins = new Set([
  'https://zyntrastudio.lk',
  'https://www.zyntrastudio.lk',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
]);
const allowedPlatforms = new Set(['Facebook', 'Instagram', 'TikTok', 'YouTube']);
const allowedEditingTypes = new Set(['basic', 'professional', 'advanced']);
const allowedAddOns = new Set(['thumbnail', 'subtitles', 'introOutro', 'motionGraphics']);
const pricing = Object.freeze({
  managementFirstPlatform: 7000,
  managementAdditionalPlatform: 1000,
  staticPosts: Object.freeze({ standardRate: 1000, bulkRate: 800, bulkRateStartsAt: 11 }),
  video25: 2000,
  video50: 3000,
  story: 1400,
  aiVideo45: 3500,
  aiVideo90: 5500,
  maximumQuantity: 999
});

type JsonRecord = Record<string, unknown>;
type ValidPackage = { total: number; quoteOnly: boolean };

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function reply(origin: string, status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readDefaultKey(dictionaryName: string, legacyName: string) {
  const dictionary = Deno.env.get(dictionaryName);
  if (dictionary) {
    try {
      const keys = JSON.parse(dictionary) as Record<string, unknown>;
      if (typeof keys.default === 'string' && keys.default) return keys.default;
    } catch (_error) { /* use the legacy key fallback */ }
  }
  return Deno.env.get(legacyName) || '';
}

function readQuantity(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= pricing.maximumQuantity ? Number(value) : null;
}

function calculateStaticPostsPrice(quantity: number) {
  if (quantity === 0) return 0;
  return quantity * (quantity < pricing.staticPosts.bulkRateStartsAt ? pricing.staticPosts.standardRate : pricing.staticPosts.bulkRate);
}

function validateAndPricePackage(value: unknown): ValidPackage | null {
  if (!isRecord(value) || !isRecord(value.quantities) || !isRecord(value.youtube)) return null;
  const quantities = value.quantities;
  const posts = readQuantity(quantities.posts);
  const video25 = readQuantity(quantities.video25);
  const video50 = readQuantity(quantities.video50);
  const stories = readQuantity(quantities.stories);
  const aiVideo45 = readQuantity(quantities.aiVideo45);
  const aiVideo90 = readQuantity(quantities.aiVideo90);
  if ([posts, video25, video50, stories, aiVideo45, aiVideo90].some((quantity) => quantity === null)) return null;

  const management = value.management === true;
  if (!Array.isArray(value.platforms) || value.platforms.length > allowedPlatforms.size) return null;
  const platforms = value.platforms.filter((platform): platform is string => typeof platform === 'string');
  if (platforms.length !== value.platforms.length || new Set(platforms).size !== platforms.length || platforms.some((platform) => !allowedPlatforms.has(platform))) return null;
  if ((management && platforms.length === 0) || (!management && platforms.length > 0)) return null;

  const youtube = value.youtube;
  const youtubeEnabled = youtube.enabled === true;
  let youtubeValid = false;
  if (youtubeEnabled) {
    if (!Array.isArray(youtube.videos) || youtube.videos.length < 1 || youtube.videos.length > 20) return null;
    const validDurations = youtube.videos.every((video) => isRecord(video) && Number.isInteger(video.durationMinutes) && Number(video.durationMinutes) >= 1 && Number(video.durationMinutes) <= 180);
    if (!validDurations || typeof youtube.editingType !== 'string' || !allowedEditingTypes.has(youtube.editingType)) return null;
    if (!Array.isArray(youtube.addOns) || youtube.addOns.length > allowedAddOns.size) return null;
    const addOns = youtube.addOns.filter((addOn): addOn is string => typeof addOn === 'string');
    if (addOns.length !== youtube.addOns.length || new Set(addOns).size !== addOns.length || addOns.some((addOn) => !allowedAddOns.has(addOn))) return null;
    youtubeValid = true;
  }

  const mainContentCount = posts! + video25! + video50! + aiVideo45! + aiVideo90!;
  if (mainContentCount === 0 && !youtubeValid) return null;
  const managementTotal = management ? pricing.managementFirstPlatform + Math.max(platforms.length - 1, 0) * pricing.managementAdditionalPlatform : 0;
  const total = managementTotal + calculateStaticPostsPrice(posts!) + video25! * pricing.video25 + video50! * pricing.video50 + stories! * pricing.story + aiVideo45! * pricing.aiVideo45 + aiVideo90! * pricing.aiVideo90;
  return { total, quoteOnly: youtubeEnabled && total === 0 };
}

function isRenderedQuotationPng(bytes: Uint8Array) {
  if (bytes.byteLength < 24) return false;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => bytes[index] === byte)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width === 2160 && height >= 600 && height <= 16000;
}

async function hashClient(value: string, secret: string) {
  const bytes = new TextEncoder().encode(secret + ':' + value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function cleanupExpiredImages(admin: ReturnType<typeof createClient>) {
  const listed = await admin.storage.from(BUCKET).list('', { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  if (listed.error || !listed.data) return;
  const cutoff = Date.now() - SIGNED_URL_SECONDS * 1000;
  const expired = listed.data.filter((object) => object.created_at && new Date(object.created_at).getTime() < cutoff).map((object) => object.name);
  if (expired.length) await admin.storage.from(BUCKET).remove(expired);
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get('Origin') || '';
  const origin = allowedOrigins.has(requestOrigin) ? requestOrigin : 'https://zyntrastudio.lk';
  if (!allowedOrigins.has(requestOrigin)) return reply(origin, 403, { success: false, error: 'Request not allowed.' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (request.method !== 'POST') return reply(origin, 405, { success: false, error: 'Method not allowed.' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) return reply(origin, 415, { success: false, error: 'Multipart form data is required.' });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES + 50000) return reply(origin, 413, { success: false, error: 'Quotation image is too large.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = readDefaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = readDefaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  if (!supabaseUrl || !secretKey || !publishableKey) return reply(origin, 503, { success: false, error: 'Secure quotation sharing is not available.' });
  if (request.headers.get('apikey') !== publishableKey) return reply(origin, 401, { success: false, error: 'A valid site key is required.' });

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rawClientAddress = (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 64);
  const clientHash = await hashClient(rawClientAddress, secretKey);
  const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const rateCheck = await admin.from('quotation_share_requests').select('id', { count: 'exact', head: true }).eq('client_hash', clientHash).gte('created_at', windowStart);
  if (rateCheck.error) return reply(origin, 503, { success: false, error: 'Quotation sharing is temporarily unavailable.' });
  if ((rateCheck.count || 0) >= RATE_LIMIT) return reply(origin, 429, { success: false, error: 'Too many quotation requests. Please wait a few minutes and try again.' });
  const rateWrite = await admin.from('quotation_share_requests').insert({ client_hash: clientHash });
  if (rateWrite.error) return reply(origin, 503, { success: false, error: 'Quotation sharing is temporarily unavailable.' });
  await admin.from('quotation_share_requests').delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  let form: FormData;
  try { form = await request.formData(); } catch (_error) { return reply(origin, 400, { success: false, error: 'Invalid quotation upload.' }); }
  const image = form.get('quotation');
  const stateText = form.get('state');
  if (!(image instanceof File) || image.type !== 'image/png' || image.size < 1000 || image.size > MAX_IMAGE_BYTES) return reply(origin, 400, { success: false, error: 'A valid quotation PNG is required.' });
  if (typeof stateText !== 'string' || stateText.length > 20000) return reply(origin, 400, { success: false, error: 'Invalid package information.' });
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  if (!isRenderedQuotationPng(imageBytes)) return reply(origin, 400, { success: false, error: 'The uploaded image was not produced by the quotation renderer.' });

  let rawState: unknown;
  try { rawState = JSON.parse(stateText); } catch (_error) { return reply(origin, 400, { success: false, error: 'Invalid package information.' }); }
  const verifiedPackage = validateAndPricePackage(rawState);
  if (!verifiedPackage) return reply(origin, 400, { success: false, error: 'The package selection is invalid.' });

  await cleanupExpiredImages(admin).catch(() => undefined);
  const objectName = crypto.randomUUID() + '.png';
  const uploaded = await admin.storage.from(BUCKET).upload(objectName, imageBytes, { contentType: 'image/png', cacheControl: String(SIGNED_URL_SECONDS), upsert: false });
  if (uploaded.error) return reply(origin, 503, { success: false, error: 'The quotation image could not be stored securely.' });
  const signed = await admin.storage.from(BUCKET).createSignedUrl(objectName, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data.signedUrl) {
    await admin.storage.from(BUCKET).remove([objectName]);
    return reply(origin, 503, { success: false, error: 'The temporary quotation link could not be created.' });
  }

  return reply(origin, 200, {
    success: true,
    url: signed.data.signedUrl,
    total: verifiedPackage.total,
    quoteOnly: verifiedPackage.quoteOnly,
    expiresAt: new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString()
  });
});
