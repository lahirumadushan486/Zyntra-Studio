'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');

assert.match(script, /managementFirstPlatform:\s*5000/, 'Management base pricing must remain unchanged');
assert.match(script, /managementAdditionalPlatform:\s*500/, 'Additional-platform pricing must remain unchanged');
assert.match(script, /postFirstTen:\s*1000/, 'Static-post pricing must remain unchanged');
assert.match(script, /postAfterTen:\s*800/, 'Progressive static-post pricing must remain unchanged');
assert.match(script, /video25:\s*2000/, '25-second video pricing must remain unchanged');
assert.match(script, /video50:\s*2500/, '50-second video pricing must remain unchanged');
assert.match(script, /story:\s*1400/, 'Story-video pricing must remain unchanged');

const referencePackageTotal = 5000 + (10 * 1000) + (5 * 2000);
assert.equal(referencePackageTotal, 25000, 'The reference package must still total Rs. 25,000');

assert.match(script, /var EXPORT_SCALE = 2;/, 'Export must render at least at 2x resolution');
assert.match(script, /html2canvas\(card,/, 'Export must render the visible package card directly');
assert.match(script, /width:\s*Math\.ceil\(bounds\.width\)/, 'Export width must match the visible card');
assert.match(script, /height:\s*Math\.ceil\(bounds\.height\)/, 'Export height must match the visible card');
assert.match(script, /windowWidth:\s*document\.documentElement\.clientWidth/, 'Export must preserve the active responsive layout');
assert.match(script, /document\.fonts\.ready/, 'Export must wait for fonts');
assert.match(script, /image\.decode\(\)/, 'Export must wait for decoded visible images');
assert.match(script, /if \(isExporting\) return;/, 'Concurrent downloads must be blocked');
assert.match(script, /downloadButton\.textContent = 'Preparing image…'/, 'Download must show a preparing state');
assert.match(script, /finally\s*\{[\s\S]*downloadLink\.remove\(\)[\s\S]*html2canvas-container[\s\S]*isExporting = false/, 'Temporary export resources must be cleaned up in finally');
assert.doesNotMatch(script, /root\.appendChild\(host\)/, 'Export must not append a duplicate card to the live calculator');
assert.doesNotMatch(script, /function createExportCard/, 'Export must not build a visible card clone');

assert.match(styles, /repeat\(auto-fit,minmax\(min\(100%,320px\),1fr\)\)/, 'Preview cards must stack when columns become too narrow');
assert.match(styles, /custom-package-card__management\{[^}]*flex-wrap:wrap/, 'Management details must wrap naturally');
assert.match(styles, /custom-package-card__items li\{[^}]*padding:18px/, 'Service cards must keep safe internal padding');
assert.match(styles, /custom-package-card__contact\{[^}]*flex-wrap:wrap/, 'Footer contact details must stay within card bounds');
assert.doesNotMatch(styles, /custom-package-card__platforms\{[^}]*(?:position:absolute|transform:|margin-top:-)/, 'Platform badges must stay in normal flow');

console.log('Custom package export contract tests: PASS');
