const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const builder = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const couponConfig = fs.readFileSync('js/coupon-config.js', 'utf8');
const quotation = fs.readFileSync('assets/js/zyntra-quotation.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/share-package-quotation/index.ts', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const quotationHtml = fs.readFileSync('quotation.html', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');

const configSource = couponConfig.match(/COUPON_CONFIG = Object\.freeze\((\{[\s\S]*?\n\})\);/);
const escapeSource = builder.match(/function escapeRegExp\(value\) \{[\s\S]*?\n  \}/);
const validatorSource = builder.match(/function validateCouponCode\(rawCode\) \{[\s\S]*?\n  \}/);
assert.ok(configSource && escapeSource && validatorSource, 'Central coupon configuration and strict validator must exist');

function createValidator(configOverride) {
  const context = {};
  vm.createContext(context);
  const config = Object.assign({}, vm.runInNewContext(`(${configSource[1]})`), configOverride || {});
  vm.runInContext(`var COUPON_CONFIG = Object.freeze(${JSON.stringify(config)}); ${escapeSource[0]} ${validatorSource[0]}`, context);
  return context.validateCouponCode;
}

const validate = createValidator();
for (const [input, code, amount] of [
  ['ZSCNO100', 'ZSCNO100', 100],
  ['ZSCNO30000', 'ZSCNO30000', 30000],
  ['ZSCNO750', 'ZSCNO750', 750],
  ['ZSCNO2750', 'ZSCNO2750', 2750],
  ['  zScNo10000  ', 'ZSCNO10000', 10000]
]) {
  assert.deepEqual(JSON.parse(JSON.stringify(validate(input))), { valid: true, code, amount }, input);
}

for (const input of [
  'ZSCNO99', 'ZSCNO30001', 'ZSCNO100.5', 'ZSCNO-100', 'ZSCNO00100',
  'ZSCNO 100', 'ZSCNO1e3', 'ZSCNO100extra', 'ZSCNO', 'OTHER100',
  'ZSCNO1,000', 'ZSCNORS100', 'ZSCNO+100'
]) {
  assert.equal(validate(input).valid, false, input);
}
assert.deepEqual(
  JSON.parse(JSON.stringify(createValidator({ enabled: false })('ZSCNO750'))),
  { valid: false, message: 'Coupon codes are currently unavailable.' }
);

assert.match(builder, /if \(couponResult\.amount >= originalTotal\) \{[\s\S]*This coupon requires a package total higher than its discount value\./);
assert.match(builder, /generatedTotal = originalTotal - \(generatedSelection\.coupon \? generatedSelection\.coupon\.amount : 0\)/);
assert.doesNotMatch(builder, /generatedTotal\s*-=|total\s*-=\s*coupon/i, 'Coupon deduction must be derived once, not stacked');
assert.match(builder, /appliedCoupon = \{ code: couponResult\.code, amount: couponResult\.amount \}/, 'Applying a second coupon replaces the first');
assert.match(builder, /couponRemoveButton\.addEventListener[\s\S]*appliedCoupon = null/, 'Coupon removal must clear the applied coupon');
assert.match(builder, /isDirty = isGenerated && selectionKey\(draftSelection\) !== selectionKey\(generatedSelection\)/);
assert.match(builder, /coupon: selection\.coupon/, 'Applied coupon must participate in draft/generated snapshot comparison');

assert.match(html, /id="custom-coupon-code"[\s\S]*id="custom-coupon-apply"[\s\S]*id="custom-coupon-remove"/);
assert.ok(html.indexOf('id="custom-coupon-code"') < html.indexOf('id="custom-package-create"'), 'Coupon controls belong before Create My Package');
assert.doesNotMatch(html.slice(html.indexOf('id="custom-package-builder"'), html.indexOf('<!-- Detailed services -->')), /ZSCNO\d|100\s*(?:to|–|-)\s*30000/i, 'Public builder must not suggest coupon codes or the allowed range');
assert.match(styles, /@media\(max-width:520px\)[^{]*\{[^}]*custom-package-builder__coupon-controls/);

const updateCardSource = builder.slice(builder.indexOf('  function updateCard'), builder.indexOf('  function updateDraftState'));
const whatsappBlock = builder.slice(builder.indexOf('  function buildWhatsAppMessage'), builder.indexOf('  function buildWhatsappUrl'));
const quotationRenderBlock = quotation.slice(quotation.indexOf('  function renderSnapshot'), quotation.indexOf('  function waitForPrintAssets'));
assert.doesNotMatch(updateCardSource, /coupon\.code|ZSCNO/, 'Generated card output must not receive the coupon code');
assert.doesNotMatch(whatsappBlock, /coupon\.code|ZSCNO/, 'WhatsApp output must not receive the coupon code');
assert.doesNotMatch(quotationRenderBlock, /coupon\.code|ZSCNO/, 'Printable quotation output must not receive the coupon code');
assert.match(builder, /Package Total: ['"] \+ formatRupees\(outputTotals\.packageTotal\)/);
assert.match(builder, /Coupon Discount: −['"] \+ formatRupees\(outputTotals\.couponDiscount\)/);
const outputTotalsSource = builder.match(/function createCouponOutputTotals\(state\) \{[\s\S]*?\n  \}/);
const whatsappSource = builder.match(/function buildWhatsAppMessage\(state, quotationUrl\) \{[\s\S]*?\n  \}/);
assert.ok(outputTotalsSource && whatsappSource, 'Code-free display model and WhatsApp quotation builder must exist');
const whatsappContext = { YOUTUBE_ADDONS: {}, formatRupees: (amount) => `Rs. ${amount.toLocaleString('en-US')}` };
vm.createContext(whatsappContext);
vm.runInContext(`${outputTotalsSource[0]} ${whatsappSource[0]}`, whatsappContext);
const whatsappMessage = whatsappContext.buildWhatsAppMessage({
  platforms: [], management: false, quoteOnly: false,
  quantities: { posts: 10, video25: 0, video50: 10, stories: 0, aiVideo45: 0, aiVideo90: 0 },
  youtube: { enabled: false }, coupon: { code: 'ZSCNO2750', amount: 2750 }, originalTotal: 40000, total: 37250
}, '');
assert.match(whatsappMessage, /Package Total: Rs\. 40,000/);
assert.match(whatsappMessage, /Coupon Discount: −Rs\. 2,750/);
assert.match(whatsappMessage, /FINAL PACKAGE TOTAL\nRs\. 37,250/);
assert.doesNotMatch(whatsappMessage, /ZSCNO2750/);
assert.match(quotationHtml, /id="quotation-original-total"[\s\S]*id="quotation-coupon-discount"[\s\S]*id="quotation-total"/);
assert.match(quotation, /snapshot\.total !== expectedOriginalTotal - \(snapshot\.coupon \? snapshot\.coupon\.amount : 0\)/);
assert.match(edge, /const total = originalTotal - \(coupon \? coupon\.amount : 0\)/);
assert.match(edge, /coupon && coupon\.amount >= originalTotal/);

console.log('Range-based coupon validation and quotation flow tests: PASS');
