const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const pricingSource = script.match(/var PRICING = Object\.freeze\((\{[\s\S]*?\n  \})\);/);
const calculatorSource = script.match(/function calculateStaticPostsPrice\(quantity\) \{[\s\S]*?\n  \}/);

assert.ok(pricingSource, 'Central pricing configuration must exist');
assert.ok(calculatorSource, 'Static Posts calculator must exist');

const context = {};
vm.createContext(context);
vm.runInContext(`var PRICING = Object.freeze(${pricingSource[1]}); ${calculatorSource[0]}`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(context.PRICING.staticPosts)),
  { standardRate: 1000, bulkRate: 800, bulkRateStartsAt: 11 }
);

const cases = new Map([
  [0, 0],
  [1, 1000],
  [2, 2000],
  [9, 9000],
  [10, 10000],
  [11, 8800],
  [12, 9600],
  [999, 799200]
]);

for (const [quantity, expected] of cases) {
  assert.equal(context.calculateStaticPostsPrice(quantity), expected, `${quantity} posts`);
}

assert.equal(context.calculateStaticPostsPrice(10), 10000, '10 → 11 starting value');
assert.equal(context.calculateStaticPostsPrice(11), 8800, '10 → 11 uses bulk rate for every post');
assert.equal(context.calculateStaticPostsPrice(10), 10000, '11 → 10 restores standard rate for every post');
assert.equal(context.calculateStaticPostsPrice(11), 8800, 'Posts-only package total');
assert.equal(context.calculateStaticPostsPrice(11) + context.PRICING.video25, 10800, 'Posts plus professional video total');
assert.equal(context.calculateStaticPostsPrice(11) + context.PRICING.managementFirstPlatform, 15800, 'Posts plus one-platform management total');

assert.doesNotMatch(script, /postFirstTen|postAfterTen|Math\.min\(quantities\.posts,\s*10\)/, 'Progressive post pricing must be removed');
assert.match(script, /var postTotal = calculateStaticPostsPrice\(quantities\.posts\);/);
assert.match(script, /var total = managementTotal \+ postTotal \+ quantities\.video25 \* PRICING\.video25 \+ quantities\.video50 \* PRICING\.video50 \+ quantities\.stories \* PRICING\.story \+ aiVideoTotal;/);
assert.match(script, /\[quantityInputs\.posts, quantityInputs\.aiVideo45, quantityInputs\.aiVideo90\]\.forEach\(addWholeQuantityInputGuards\);/);
assert.match(html, /A special per-post rate applies when selecting 11 or more posts\./);
assert.doesNotMatch(html, /Progressive pricing applies from post 10 onward\./);

// Public calculator and generated/exported card expose only the final package total.
assert.doesNotMatch(html, /(?:post|posts)[ -]?subtotal/i);
assert.doesNotMatch(script, /(?:post|posts)[ -]?subtotal/i);
assert.match(script, /var exportCard = card\.cloneNode\(true\);/, 'PNG must clone the generated card');
assert.match(script, /quantityInputs\.posts\.value = String\(readSharedInteger\(params, 'posts', 0, PRICING\.maximumQuantity, 0\)\);/, 'Shared post quantity must restore safely');

console.log('Static Posts pricing tests passed.');
