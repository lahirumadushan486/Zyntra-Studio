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
assert.match(html, /id="custom-package-whatsapp"[^>]*aria-label="Send quotation to Zyntra Studio on WhatsApp"[^>]*disabled/);
assert.match(html, /<svg[^>]*aria-hidden="true"[\s\S]*<span>Send to WhatsApp<\/span>/);
assert.doesNotMatch(html, /custom-package-whatsapp-(?:retry|text|fallback)|Send Quotation Details Instead|Try Again/);

assert.equal((script.match(/947046004033/g) || []).length, 1, 'The WhatsApp number must have one frontend source of truth');
assert.match(script, /var WHATSAPP_CONFIG = Object\.freeze\(\{[\s\S]*companyNumber: '947046004033'/);
assert.match(script, /cardWhatsappContact\.textContent = 'Call \/ WhatsApp: ' \+ formatLocalWhatsappNumber\(WHATSAPP_CONFIG\.companyNumber\)/);
assert.match(script, /'https:\/\/wa\.me\/' \+ WHATSAPP_CONFIG\.companyNumber \+ '\?text=' \+ encodeURIComponent\(message\)/);
assert.doesNotMatch(script, /wa\.me\/947046004033/, 'The fixed number must not be duplicated in URL construction');
const start = script.indexOf('  function buildWhatsAppMessage');
const end = script.indexOf('  function resetWhatsAppButton', start);
assert.ok(start >= 0 && end > start, 'WhatsApp message and URL builders must exist');
const context = {
  WHATSAPP_CONFIG: { companyNumber: '947046004033' },
  YOUTUBE_ADDONS: { thumbnail: 'Thumbnail Design', subtitles: 'Subtitles', introOutro: 'Intro / Outro', motionGraphics: 'Motion Graphics' },
  formatRupees: (amount) => 'Rs. ' + amount.toLocaleString('en-US'),
  encodeURIComponent
};
vm.createContext(context);
vm.runInContext(script.slice(start, end), context);

const state = {
  platforms: ['Facebook', 'Instagram'],
  quantities: { posts: 11, video25: 1, video50: 0, stories: 0, aiVideo45: 1, aiVideo90: 0 },
  management: true,
  youtube: { enabled: false, videoCount: 1, videos: [{ durationMinutes: 1 }], editingTypeLabel: '', addOns: [] },
  quoteOnly: false,
  total: 21300
};
const message = context.buildWhatsAppMessage(state, 'https://example.test/quotation');
assert.match(message, /Platforms: Facebook, Instagram/);
assert.match(message, /Static Posts: 11/);
assert.match(message, /Professional Videos up to 25 seconds: 1/);
assert.match(message, /AI Videos up to 45 seconds: 1/);
assert.match(message, /Social Media Management: Included/);
assert.match(message, /FINAL PACKAGE TOTAL\nRs\. 21,300/);
assert.match(message, /Quotation Image: https:\/\/example\.test\/quotation/);
assert.doesNotMatch(message, /Professional Videos up to 50 seconds|Simple Story Videos|AI Videos up to 1\.5 minutes/);
assert.equal((message.match(/Rs\./g) || []).length, 1, 'Message must contain only the final monetary total');

const multilingualMessage = message + '\nසිංහල පරීක්ෂාව';
const whatsappUrl = context.buildWhatsappUrl(multilingualMessage);
assert.equal(whatsappUrl.indexOf('https://wa.me/947046004033?text='), 0);
assert.equal(decodeURIComponent(whatsappUrl.split('?text=')[1]), multilingualMessage, 'English, Sinhala, spaces, symbols and line breaks must round-trip through one encoding pass');

assert.match(script, /preparedWhatsappUrl = state\.valid \? buildWhatsappUrl\(buildWhatsAppMessage\(state, ''\)\) : '';/, 'Every state update must prepare the completed URL');
assert.match(script, /whatsappButton\.addEventListener\('click', function \(\) \{[\s\S]*var state = update\(\);[\s\S]*var whatsappUrl = preparedWhatsappUrl;[\s\S]*window\.location\.assign\(whatsappUrl\);/);
const clickStart = script.indexOf("  whatsappButton.addEventListener('click'");
const clickEnd = script.indexOf("  window.addEventListener('pageshow'", clickStart);
const clickHandler = script.slice(clickStart, clickEnd);
assert.doesNotMatch(clickHandler, /\basync\b|\bawait\b|renderQuotationBlob|uploadQuotationImage|fetch\(/, 'Click navigation must not wait for image rendering or upload');
assert.doesNotMatch(script, /window\.open\(|about:blank|prepareWhatsappWindow|uploadQuotationImage|setFormBusy/);
assert.doesNotMatch(script + html, /Send Quotation Details Instead|custom-package-whatsapp-fallback|Your latest quotation is ready in WhatsApp/);
assert.match(clickHandler, /if \(isWhatsappSharing \|\| isExporting\) return;/, 'Double clicks must be ignored');
assert.match(script, /window\.setTimeout\(resetWhatsAppButton, 1500\)/, 'The opening state must recover if navigation is interrupted');
assert.match(script, /window\.addEventListener\('pageshow', resetWhatsAppButton\)/, 'The button must reset when the customer returns with Back');

assert.match(script, /async function renderQuotationBlob\(\)/, 'Image download must retain its independent renderer');
assert.equal((script.match(/var blob = await renderQuotationBlob\(\)/g) || []).length, 1, 'Only Download Quotation may render an image');

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
