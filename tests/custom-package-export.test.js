'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');

assert.match(script, /managementFirstPlatform:\s*7000/, 'Management base pricing must remain unchanged');
assert.match(script, /managementAdditionalPlatform:\s*1000/, 'Additional-platform pricing must remain unchanged');
assert.match(script, /postFirstTen:\s*1000/, 'Static-post pricing must remain unchanged');
assert.match(script, /postAfterTen:\s*800/, 'Progressive static-post pricing must remain unchanged');
assert.match(script, /video25:\s*2000/, '25-second video pricing must remain unchanged');
assert.match(script, /video50:\s*3000/, '50-second video pricing must remain unchanged');
assert.match(script, /story:\s*1400/, 'Story-video pricing must remain unchanged');

const referencePackageTotal = 7000 + (10 * 1000) + (5 * 2000);
assert.equal(referencePackageTotal, 27000, 'The reference package must still total Rs. 27,000');

assert.match(script, /var EXPORT_SCALE = 2;/, 'Export must render at least at 2x resolution');
assert.match(script, /var EXPORT_WIDTH = 1080;/, 'Export must use a stable design width');
assert.match(script, /card\.cloneNode\(true\)/, 'Export must clone only the package card');
assert.match(script, /classList\.add\('custom-package-card--export'\)/, 'Export clone must receive its isolated class');
assert.match(script, /root\.appendChild\(exportCard\)/, 'Export clone must render within the styled builder scope');
assert.match(script, /await nextAnimationFrame\(\);[\s\S]*await nextAnimationFrame\(\);/, 'Export must wait for two layout frames');
assert.match(script, /Math\.ceil\(exportCard\.scrollWidth\)/, 'Export width must match clone content');
assert.match(script, /Math\.ceil\(exportCard\.scrollHeight\)/, 'Export height must match clone content');
assert.match(script, /html2canvas\(exportCard,/, 'Export must capture the isolated card clone');
assert.match(script, /windowWidth:\s*exportWidth/, 'Export window width must match the clone');
assert.match(script, /windowHeight:\s*exportHeight/, 'Export window height must match the clone');
assert.match(script, /allowTaint:\s*false/, 'Cross-origin image capture must remain safe');
assert.match(script, /document\.fonts\.ready/, 'Export must wait for fonts');
assert.match(script, /image\.decode\(\)/, 'Export must wait for decoded visible images');
assert.match(script, /if \(isExporting\) return;/, 'Concurrent downloads must be blocked');
assert.match(script, /downloadButton\.textContent = 'Preparing image…'/, 'Download must show a preparing state');
assert.match(script, /finally\s*\{[\s\S]*exportCard\.remove\(\)[\s\S]*downloadLink\.remove\(\)[\s\S]*html2canvas-container[\s\S]*isExporting = false/, 'Temporary export resources must be cleaned up in finally');
assert.doesNotMatch(script, /windowHeight:\s*document\.documentElement\.clientHeight/, 'Export must not use the mobile viewport height');

assert.match(styles, /repeat\(auto-fit,minmax\(min\(100%,320px\),1fr\)\)/, 'Preview cards must stack when columns become too narrow');
assert.match(styles, /custom-package-card--export\{[^}]*position:fixed!important[^}]*left:-100000px!important[^}]*height:auto!important[^}]*min-height:0!important[^}]*max-height:none!important[^}]*overflow:visible!important/, 'Export clone must be off-screen and content-sized');
assert.match(styles, /custom-package-card--export,#custom-package-builder \.custom-package-card--export \*\{box-sizing:border-box\}/, 'Export clone descendants must use border-box sizing');
assert.match(styles, /custom-package-card__management\{[^}]*flex-wrap:wrap/, 'Management details must wrap naturally');
assert.match(styles, /custom-package-card__items li\{[^}]*padding:18px/, 'Service cards must keep safe internal padding');
assert.match(styles, /custom-package-card__contact\{[^}]*flex-wrap:wrap/, 'Footer contact details must stay within card bounds');
assert.doesNotMatch(styles, /custom-package-card__platforms\{[^}]*(?:position:absolute|transform:|margin-top:-)/, 'Platform badges must stay in normal flow');

console.log('Custom package export contract tests: PASS');
