const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const schema = fs.readFileSync('js/quotation-schema.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const quotationScript = fs.readFileSync('assets/js/zyntra-quotation.js', 'utf8');
const shareFunction = fs.readFileSync('supabase/functions/share-package-quotation/index.ts', 'utf8');

const pricingSource = schema.match(/export const QUOTATION_PRICING = Object\.freeze\((\{[\s\S]*?\n\})\);/);
const calculatorSource = schema.match(/export function calculateStaticPostsPrice\(quantity\) \{[\s\S]*?\n\}/);

assert.ok(pricingSource, 'Central pricing configuration must exist');
assert.ok(calculatorSource, 'Static Posts calculator must exist');

const context = {};
vm.createContext(context);
vm.runInContext(`var QUOTATION_PRICING = Object.freeze(${pricingSource[1]}); ${calculatorSource[0].replace('export ', '')}`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(context.QUOTATION_PRICING.staticPosts)),
  { standardRate: 1000, bulkRate: 900, bulkRateStartsAt: 11, fullOrderBulkRateStartsAt: 20 }
);

const cases = new Map([
  [0, 0],
  [1, 1000],
  [2, 2000],
  [8, 8000],
  [9, 9000],
  [10, 10000],
  [11, 10900],
  [12, 11800],
  [19, 18100],
  [20, 18000],
  [21, 18900],
  [40, 36000],
  [50, 45000],
  [999, 899100]
]);

for (const [quantity, expected] of cases) {
  assert.equal(context.calculateStaticPostsPrice(quantity), expected, `${quantity} posts`);
}

assert.equal(context.calculateStaticPostsPrice(10), 10000, '10 → 11 starting value');
assert.equal(context.calculateStaticPostsPrice(11), 10900, '10 → 11 adds one discounted post');
assert.notEqual(context.calculateStaticPostsPrice(11), 11 * 900, '11 posts must not reprice the first 10 posts');
assert.equal(context.calculateStaticPostsPrice(19), 18100, '19 posts use progressive pricing');
assert.equal(context.calculateStaticPostsPrice(20), 18000, '20 posts apply the bulk rate to the full order');
assert.ok(context.calculateStaticPostsPrice(20) < context.calculateStaticPostsPrice(19), 'The intentional 19 → 20 total reduction must remain');
assert.equal(context.calculateStaticPostsPrice(10), 10000, '11 → 10 removes the additional post');
assert.equal(context.calculateStaticPostsPrice(11), 10900, 'Posts-only package total');
assert.equal(context.calculateStaticPostsPrice(11) + context.QUOTATION_PRICING.video25, 12900, 'Posts plus professional video total');
assert.equal(context.calculateStaticPostsPrice(11) + context.QUOTATION_PRICING.managementFirstPlatform, 17900, 'Posts plus one-platform management total');

assert.match(calculatorSource[0], /if \(count <= standardLimit\) return count \* QUOTATION_PRICING\.staticPosts\.standardRate;/);
assert.match(calculatorSource[0], /if \(count < QUOTATION_PRICING\.staticPosts\.fullOrderBulkRateStartsAt\)/);
assert.match(calculatorSource[0], /return count \* QUOTATION_PRICING\.staticPosts\.bulkRate;/);
assert.match(quotationScript, /quotation-schema\.js/, 'Printable quotation must use the shared pricing and schema module');
assert.match(shareFunction, /staticPosts: Object\.freeze\(\{ standardRate: 1000, bulkRate: 900, bulkRateStartsAt: 11, fullOrderBulkRateStartsAt: 20 \}\)/, 'Server-side share validation must use the same thresholds and rates');
assert.match(shareFunction, /if \(quantity < pricing\.staticPosts\.fullOrderBulkRateStartsAt\)[\s\S]*return quantity \* pricing\.staticPosts\.bulkRate;/, 'Server-side share validation must apply the full-order bulk tier');
assert.match(script, /return calculateQuotationTotal\(selection\);/);
assert.match(script, /\[quantityInputs\.posts, quantityInputs\.aiVideo45, quantityInputs\.aiVideo90\]\.forEach\(addWholeQuantityInputGuards\);/);
assert.match(html, /Posts 1–10 are Rs\. 1,000 each\. Posts 11–19 add Rs\. 900 each; at 20 or more, every post is Rs\. 900\./);

// Public calculator and generated/exported card expose only the final package total.
assert.doesNotMatch(html, /(?:post|posts)[ -]?subtotal/i);
assert.doesNotMatch(script, /(?:post|posts)[ -]?subtotal/i);
assert.match(script, /if \(state\.quantities\.posts > 0\) add\('posts'/, 'Quotation snapshot must include selected static posts');
assert.match(script, /quantityInputs\.posts\.value = String\(readSharedInteger\(params, 'posts', 0, PRICING\.maximumQuantity, 0\)\);/, 'Shared post quantity must restore safely');

console.log('Static Posts pricing tests passed.');
