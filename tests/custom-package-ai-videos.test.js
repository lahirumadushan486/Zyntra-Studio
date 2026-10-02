'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');

const pricingSource = script.match(/var PRICING = Object\.freeze\((\{[\s\S]*?\n  \})\);/);
const calculatorSource = script.match(/function calculateAiVideosPrice\(aiVideo45Quantity, aiVideo90Quantity\) \{[\s\S]*?\n  \}/);
assert.ok(pricingSource, 'Central pricing configuration must exist');
assert.ok(calculatorSource, 'AI video calculator must exist');

const context = {};
vm.createContext(context);
vm.runInContext(`var PRICING = Object.freeze(${pricingSource[1]}); ${calculatorSource[0]}`, context);

assert.equal(context.PRICING.aiVideo45, 3500);
assert.equal(context.PRICING.aiVideo90, 5500);
assert.equal(context.calculateAiVideosPrice(1, 0), 3500, 'One 45-second AI video');
assert.equal(context.calculateAiVideosPrice(2, 0), 7000, 'Two 45-second AI videos');
assert.equal(context.calculateAiVideosPrice(0, 1), 5500, 'One 1.5-minute AI video');
assert.equal(context.calculateAiVideosPrice(0, 2), 11000, 'Two 1.5-minute AI videos');
assert.equal(context.calculateAiVideosPrice(1, 1), 9000, 'Both AI video types');
assert.equal(context.calculateAiVideosPrice(0, 0), 0);
assert.equal(context.calculateAiVideosPrice(-1, 1.9), 5500, 'Calculator normalizes negative and decimal inputs defensively');
assert.equal(context.PRICING.staticPosts.standardRate + context.calculateAiVideosPrice(1, 0), 4500, 'One static post plus one 45-second AI video');
assert.equal(context.PRICING.video25 + context.calculateAiVideosPrice(1, 0), 5500, 'One professional video plus one 45-second AI video');
assert.equal(context.PRICING.managementFirstPlatform + context.calculateAiVideosPrice(1, 0), 10500, 'One-platform management plus one 45-second AI video');

assert.match(html, /Simple Story Videos[\s\S]*id="custom-ai-videos-title">AI Videos/);
assert.match(html, /id="custom-ai-video-45-count"[^>]*min="0"[^>]*max="999"[^>]*step="1"/);
assert.match(html, /id="custom-ai-video-90-count"[^>]*min="0"[^>]*max="999"[^>]*step="1"/);
assert.match(html, /aria-label="Decrease AI videos up to 45 seconds"/);
assert.match(html, /aria-label="Increase AI videos up to 45 seconds"/);
assert.match(html, /aria-label="Decrease AI videos up to 1\.5 minutes"/);
assert.match(html, /aria-label="Increase AI videos up to 1\.5 minutes"/);

assert.match(script, /var aiVideoTotal = calculateAiVideosPrice\(quantities\.aiVideo45, quantities\.aiVideo90\);/);
assert.match(script, /mainContentCount = quantities\.posts \+ quantities\.video25 \+ quantities\.video50 \+ quantities\.aiVideo45 \+ quantities\.aiVideo90/);
assert.match(script, /hasPrimaryContent = mainContentCount > 0 \|\| youtube\.valid/);
assert.match(script, /root\.querySelectorAll\('\[data-quantity-control\]'\)/, 'AI controls must reuse the existing increment/decrement behavior');
assert.match(script, /input\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/, 'Quantity buttons must recalculate immediately');
assert.match(script, /if \(state\.quantities\.aiVideo45 > 0\) selectedItems\.push\(\['AI Videos up to 45 seconds:'/);
assert.match(script, /if \(state\.quantities\.aiVideo90 > 0\) selectedItems\.push\(\['AI Videos up to 1\.5 minutes:'/);
assert.match(script, /if \(hasGeneratedCard\)[\s\S]*updateCard\(state\)/, 'Generated card must refresh after quantity changes');

assert.match(script, /url\.searchParams\.set\('aiVideo45', String\(state\.quantities\.aiVideo45\)\)/);
assert.match(script, /url\.searchParams\.set\('aiVideo90', String\(state\.quantities\.aiVideo90\)\)/);
assert.match(script, /quantityInputs\.aiVideo45\.value = String\(readSharedInteger\(params, 'aiVideo45', 0, PRICING\.maximumQuantity, 0\)\)/);
assert.match(script, /quantityInputs\.aiVideo90\.value = String\(readSharedInteger\(params, 'aiVideo90', 0, PRICING\.maximumQuantity, 0\)\)/);

assert.doesNotMatch(html.slice(html.indexOf('id="custom-package-builder"')), /Rs\.\s*(?:3,500|5,500)/, 'AI service rows must not expose separate prices');
assert.match(script, /var exportCard = card\.cloneNode\(true\);/, 'PNG must use the visible generated card');
assert.match(script, /renderedRevision !== cardRevision/, 'PNG must reject stale card renders');
assert.match(script, /await waitForCardAssets\(card\)/, 'PNG must wait for visible card assets');
assert.match(script, /await waitForCardAssets\(exportCard\)/, 'PNG must wait for cloned card assets');

assert.match(styles, /custom-package-builder__ai-video-option\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/);
assert.match(styles, /@media\(max-width:390px\)\{[^}]*custom-package-builder__ai-video-option\{grid-template-columns:minmax\(0,1fr\)/);
assert.doesNotMatch(styles, /custom-package-builder__ai-(?:videos|video-option)\{[^}]*(?:width:\s*\d{4,}px|min-width:\s*\d{4,}px)/);

// Existing prices and quote-only behavior remain contract values.
assert.match(script, /managementFirstPlatform:\s*7000/);
assert.match(script, /managementAdditionalPlatform:\s*1000/);
assert.match(script, /standardRate:\s*1000/);
assert.match(script, /bulkRate:\s*800/);
assert.match(script, /video25:\s*2000/);
assert.match(script, /video50:\s*3000/);
assert.match(script, /story:\s*1400/);
assert.match(script, /quoteOnly: youtube\.enabled && total === 0/);

console.log('Custom package AI video tests: PASS');
