'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const home = fs.readFileSync('index.html', 'utf8');
const offers = fs.readFileSync('offers.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');
const styles = fs.readFileSync('style.css', 'utf8');
const facebookUrl = 'https://www.facebook.com/zyntrastudio97';

assert.equal((script.match(new RegExp(facebookUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, 'Facebook URL must have one source of truth');
assert.doesNotMatch(home + offers, /https:\/\/www\.facebook\.com\/zyntrastudio97/, 'Page markup must use the shared social configuration');
assert.match(script, /const SOCIAL_LINKS = Object\.freeze\(\{[\s\S]*facebook: "https:\/\/www\.facebook\.com\/zyntrastudio97"[\s\S]*\}\);/);
assert.match(script, /function initializeSocialLinks\(\)[\s\S]*querySelectorAll\('\[data-social-link\]'\)[\s\S]*link\.href = SOCIAL_LINKS\[platform\]/);
assert.match(script, /initializeBrandLogos\(\);\s*initializeSocialLinks\(\);/);

for (const [name, html] of [['home', home], ['offers', offers]]) {
  assert.equal((html.match(/data-social-link="facebook"/g) || []).length, 2, `${name} must have one header and one footer Facebook link`);
  assert.equal((html.match(/aria-label="Follow Zyntra Studio on Facebook"/g) || []).length, 2);
  assert.equal((html.match(/title="Follow Zyntra Studio on Facebook"/g) || []).length, 2);
  assert.equal((html.match(/target="_blank"/g) || []).filter(Boolean).length >= 2, true);
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).filter(Boolean).length >= 2, true);
  assert.match(html, /nav-review-button[\s\S]*facebook-link facebook-link--header[\s\S]*(?:nav-portal-button|nav-cta)/, `${name} header link must stay in the existing action area`);
  assert.match(html, /footer-brand[\s\S]*facebook-link facebook-link--footer[\s\S]*Follow Zyntra Studio[\s\S]*@zyntrastudio97/, `${name} footer link must stay with contact details`);
}

assert.match(styles, /facebook-link\{[^}]*min-height:44px/);
assert.match(styles, /site-header\{[^}]*max-width:1400px/, 'Desktop header must leave enough room for the Facebook action without overlapping the brand');
assert.match(styles, /facebook-link--header\{[^}]*width:40px[^}]*border-radius:50%/);
assert.match(styles, /facebook-link:focus-visible\{[^}]*outline:2px solid var\(--cyan-accent\)/);
assert.match(styles, /@media\(max-width:1100px\)\{\.facebook-link--header\{display:flex;width:100%;min-height:44px/);
assert.match(styles, /@media\(max-width:560px\)\{\.facebook-link--footer\{width:100%;min-height:44px/);
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{\.facebook-link\{transition:none!important\}/);

console.log('Shared Facebook link tests: PASS');
