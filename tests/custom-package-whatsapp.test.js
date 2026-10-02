'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');
const edge = fs.readFileSync('supabase/functions/share-package-quotation/index.ts', 'utf8');
const sql = fs.readFileSync('supabase/quotation-share-setup.sql', 'utf8');

assert.match(html, /id="custom-package-download"[\s\S]*id="custom-package-whatsapp"/);
assert.match(html, /id="custom-package-whatsapp"[^>]*disabled/);
assert.match(html, /<svg[^>]*aria-hidden="true"[\s\S]*<span>Send to WhatsApp<\/span>/);
assert.match(html, /id="custom-package-whatsapp-retry"[^>]*>Try Again<\/button>/);
assert.match(html, /id="custom-package-whatsapp-text"[^>]*>Send Quotation Details Instead<\/button>/);

assert.equal((script.match(/947046004033/g) || []).length, 1, 'The WhatsApp number must have one frontend source of truth');
assert.match(script, /var WHATSAPP_CONFIG = Object\.freeze\(\{[\s\S]*companyNumber: '947046004033'/);
assert.match(script, /cardWhatsappContact\.textContent = 'Call \/ WhatsApp: ' \+ formatLocalWhatsappNumber\(WHATSAPP_CONFIG\.companyNumber\)/);
assert.match(script, /'https:\/\/wa\.me\/' \+ WHATSAPP_CONFIG\.companyNumber \+ '\?text=' \+ encodeURIComponent\(message\)/);
assert.doesNotMatch(script, /wa\.me\/947046004033/, 'The fixed number must not be duplicated in URL construction');
assert.match(script, /return \{ apikey: SUPABASE_PUBLISHABLE_KEY \};/);
assert.doesNotMatch(script, /Authorization: 'Bearer ' \+ SUPABASE_PUBLISHABLE_KEY/);

const start = script.indexOf('  function buildWhatsAppMessage');
const end = script.indexOf('  function openWhatsApp', start);
assert.ok(start >= 0 && end > start, 'WhatsApp message builder must exist');
const context = {
  YOUTUBE_ADDONS: { thumbnail: 'Thumbnail Design', subtitles: 'Subtitles', introOutro: 'Intro / Outro', motionGraphics: 'Motion Graphics' },
  formatRupees: (amount) => 'Rs. ' + amount.toLocaleString('en-US')
};
vm.createContext(context);
vm.runInContext(script.slice(start, end), context);

const state = {
  platforms: ['Facebook', 'Instagram'],
  quantities: { posts: 11, video25: 1, video50: 0, stories: 0, aiVideo45: 1, aiVideo90: 0 },
  management: true,
  youtube: { enabled: false, videoCount: 1, videos: [{ durationMinutes: 1 }], editingTypeLabel: '', addOns: [] },
  quoteOnly: false
};
const message = context.buildWhatsAppMessage(state, 'https://example.test/quotation', 21300);
assert.match(message, /Platforms: Facebook, Instagram/);
assert.match(message, /Static Posts: 11/);
assert.match(message, /Professional Videos up to 25 seconds: 1/);
assert.match(message, /AI Videos up to 45 seconds: 1/);
assert.match(message, /Social Media Management: Included/);
assert.match(message, /FINAL PACKAGE TOTAL\nRs\. 21,300/);
assert.match(message, /Quotation: https:\/\/example\.test\/quotation/);
assert.doesNotMatch(message, /Professional Videos up to 50 seconds|Simple Story Videos|AI Videos up to 1\.5 minutes/);
assert.equal((message.match(/Rs\./g) || []).length, 1, 'Message must contain only the final monetary total');

assert.match(script, /async function renderQuotationBlob\(\)/);
assert.ok((script.match(/var blob = await renderQuotationBlob\(\)/g) || []).length >= 2, 'Download and WhatsApp must share the renderer');
assert.match(script, /hasGeneratedCard = true;[\s\S]*updateCard\(state\);[\s\S]*var blob = await renderQuotationBlob\(\)/, 'WhatsApp must refresh the card before rendering');
assert.match(script, /isWhatsappSharing \|\| isExporting/, 'Repeated WhatsApp renders must be blocked');
assert.match(script, /setFormBusy\(true\)/, 'Selections must be frozen while the latest card is rendered');
assert.match(script, /window\.open\('about:blank', 'zyntra-package-whatsapp'\)/, 'A target must be prepared before asynchronous upload');
assert.match(script, /window\.location\.assign\(whatsappUrl\)/, 'Popup blocking must fall back to same-tab navigation');
assert.match(script, /Preparing Quotation…/);
assert.match(script, /Opening WhatsApp…/);
assert.match(script, /Quotation details were shared as text; no image was uploaded\./);

assert.match(styles, /custom-package-builder__quotation-actions\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)/);
assert.match(styles, /@media\(max-width:700px\)\{[^}]*custom-package-builder__quotation-actions\{grid-template-columns:minmax\(0,1fr\)/);

assert.match(sql, /'quotation-images', 'quotation-images', false, 8388608, array\['image\/png'\]/);
assert.match(sql, /alter table public\.quotation_share_requests enable row level security/);
assert.match(sql, /revoke all on table public\.quotation_share_requests from anon, authenticated/);
assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(edge, /readDefaultKey\('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'\)/);
assert.match(edge, /readDefaultKey\('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'\)/);
assert.match(edge, /request\.headers\.get\('apikey'\) !== publishableKey/);
assert.doesNotMatch(script + html, /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i, 'No privileged key may appear in browser code');
assert.match(edge, /crypto\.randomUUID\(\) \+ '\.png'/);
assert.match(edge, /SIGNED_URL_SECONDS = 7 \* 24 \* 60 \* 60/);
assert.match(edge, /createSignedUrl\(objectName, SIGNED_URL_SECONDS\)/);
assert.match(edge, /MAX_IMAGE_BYTES = 8 \* 1024 \* 1024/);
assert.match(edge, /isRenderedQuotationPng\(imageBytes\)/);
assert.match(edge, /width === 2160/);
assert.match(edge, /RATE_LIMIT = 5/);
assert.match(edge, /hashClient\(rawClientAddress, secretKey\)/);
assert.match(edge, /validateAndPricePackage\(rawState\)/);
assert.doesNotMatch(edge, /(?:input|rawState|value)\.total/, 'Server must never trust a browser-submitted total');
assert.match(edge, /cleanupExpiredImages\(admin\)/);

console.log('Custom package WhatsApp sharing tests: PASS');
