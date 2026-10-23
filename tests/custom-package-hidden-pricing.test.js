'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');

const builderHtml = html.slice(html.indexOf('id="custom-package-builder"'), html.indexOf('<!-- Detailed services -->'));
const draftUpdate = script.slice(script.indexOf('  function updateDraftState'), script.indexOf('  function refreshYoutubeDurationTotal'));
const submitHandler = script.slice(script.indexOf("  form.addEventListener('submit'"), script.indexOf('  function buildPackageBuilderUrl'));
const downloadHandler = script.slice(script.indexOf("  downloadButton.addEventListener('click'"), script.indexOf("  whatsappButton.addEventListener('click'"));

// The initial DOM must contain instructions, not a placeholder or live amount.
assert.match(builderHtml, /id="custom-package-total"[^>]*>Your final package total will be shown after you create the package\.<\/output>/);
assert.match(builderHtml, /id="custom-package-result" hidden/);
assert.match(builderHtml, /id="custom-package-download"[^>]*hidden disabled/);
assert.match(builderHtml, /id="custom-package-whatsapp"[^>]*disabled/);
assert.doesNotMatch(builderHtml, /id="custom-package-total"[^>]*>\s*Rs\./);
assert.doesNotMatch(builderHtml, /id="custom-card-total"[^>]*>\s*Rs\./);

// Draft edits validate and mark staleness but never calculate, format, publish, or share prices.
assert.match(script, /var draftSelection = null;[\s\S]*var generatedSelection = null;[\s\S]*var generatedTotal = null;[\s\S]*var isGenerated = false;[\s\S]*var isDirty = false;/);
assert.match(draftUpdate, /draftSelection = readDraftSelection\(\)/);
assert.match(draftUpdate, /isDirty = isGenerated && selectionKey\(draftSelection\) !== selectionKey\(generatedSelection\)/);
assert.doesNotMatch(draftUpdate, /calculatePackageTotal|calculateStaticPostsPrice|calculateAiVideosPrice|formatRupees|updateCard|buildWhatsAppMessage/);
assert.match(draftUpdate, /Your selections have changed\. Click Create My Package to update your quotation\./);
assert.match(draftUpdate, /result\.hidden = true;[\s\S]*downloadButton\.disabled = true;[\s\S]*whatsappButton\.disabled = true;/);

// A valid submit snapshots the draft and is the sole caller of the aggregate calculator.
assert.match(submitHandler, /generatedSelection = cloneSelection\(draftSelection\)/);
assert.match(submitHandler, /generatedTotal = calculatePackageTotal\(generatedSelection\)/);
assert.match(submitHandler, /updateCard\(generatedState\)/);
assert.match(submitHandler, /currentQuotationSnapshot = createQuotationSnapshot\(generatedState\)/);
assert.match(submitHandler, /writeSessionJson\(QUOTATION_STORAGE_KEY, currentQuotationSnapshot\)/);

// Download and WhatsApp can only use a clean generated snapshot.
assert.match(downloadHandler, /if \(!isGenerated \|\| isDirty\) return/);
assert.match(downloadHandler, /writeSessionJson\(QUOTATION_STORAGE_KEY, currentQuotationSnapshot\)/);
assert.match(downloadHandler, /window\.location\.assign\('quotation\.html'\)/);
assert.doesNotMatch(downloadHandler, /updateCard\(|calculatePackageTotal\(/);
assert.match(script, /if \(!isGenerated \|\| isDirty \|\| !preparedWhatsappUrl\)/);

// Shared links contain selections only, never totals or pricing breakdowns.
const shareBuilder = script.slice(script.indexOf('  function buildPackageBuilderUrl'), script.indexOf('  function readSharedInteger'));
assert.doesNotMatch(shareBuilder, /generatedTotal|\.total\b|price|PRICING/);
assert.doesNotMatch(script, /console\.(?:log|debug|info)\(/);

// The compact instruction remains responsive and does not force horizontal overflow.
assert.match(styles, /custom-package-builder__total\{[^}]*font-size:clamp\(\.9rem,1\.8vw,1\.05rem\)[^}]*overflow-wrap:anywhere/);
assert.match(styles, /custom-package-builder__summary\{align-items:flex-start;flex-direction:column;padding:17px\}/);
assert.match(styles, /custom-package-builder__total\{font-size:clamp\(\.9rem,4vw,1rem\)\}/);

console.log('Custom package hidden-pricing state tests: PASS');
