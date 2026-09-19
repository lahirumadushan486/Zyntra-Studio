'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');

assert.match(script, /managementFirstPlatform:\s*5000/, 'Management base pricing must remain unchanged');
assert.match(script, /managementAdditionalPlatform:\s*500/, 'Additional-platform pricing must remain unchanged');
assert.match(script, /postFirstFive:\s*1000/, 'Static-post pricing must remain unchanged');
assert.match(script, /postAfterFive:\s*800/, 'Progressive static-post pricing must remain unchanged');
assert.match(script, /video25:\s*1800/, '25-second video pricing must remain unchanged');
assert.match(script, /video50:\s*2500/, '50-second video pricing must remain unchanged');
assert.match(script, /story:\s*1400/, 'Story-video pricing must remain unchanged');

const screenshotPackageTotal = 5000 + (5 * 1000) + (5 * 1800);
assert.equal(screenshotPackageTotal, 19000, 'The referenced package must still total Rs. 19,000');

assert.match(script, /var EXPORT_WIDTH = 900;/, 'Export must use a stable width');
assert.match(script, /var EXPORT_SCALE = 2;/, 'Export must render at least at 2x resolution');
assert.match(script, /height:\s*exportHeight/, 'Export height must grow with card content');
assert.match(script, /windowWidth:\s*1200/, 'Export media queries must be independent of the device viewport');
assert.match(script, /assets\/zyntra-studio-logo\.jpg/, 'Export must use the same-origin logo asset');
assert.match(script, /document\.fonts\.ready/, 'Export must wait for fonts');
assert.match(script, /requestAnimationFrame[\s\S]*requestAnimationFrame/, 'Export must wait for final layout frames');

assert.match(styles, /custom-package-card--export\{[^}]*width:900px/, 'Export card CSS must enforce the fixed width');
assert.match(styles, /repeat\(auto-fit,minmax\(min\(100%,320px\),1fr\)\)/, 'Preview cards must stack when columns become too narrow');
assert.match(styles, /custom-package-card__management\{[^}]*flex-wrap:wrap/, 'Management details must wrap naturally');
assert.match(styles, /custom-package-card__items li\{[^}]*padding:18px/, 'Service cards must keep safe internal padding');
assert.match(styles, /custom-package-card__contact\{[^}]*flex-wrap:wrap/, 'Footer contact details must stay within card bounds');
assert.doesNotMatch(styles, /custom-package-card__platforms\{[^}]*(?:position:absolute|transform:|margin-top:-)/, 'Platform badges must stay in normal flow');

console.log('Custom package export contract tests: PASS');
