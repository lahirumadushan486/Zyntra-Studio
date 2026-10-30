'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('js/snowfall.js', 'utf8');
const styles = fs.readFileSync('css/snowfall.css', 'utf8');
const home = fs.readFileSync('index.html', 'utf8');
const offers = fs.readFileSync('offers.html', 'utf8');
const excludedPages = ['admin-dashboard.html', 'admin-login.html', 'client-login.html', 'client-portal.html', 'client-register.html', 'portal-access.html', 'quotation.html'];

for (const key of ['enabled', 'desktopParticleLimit', 'mobileParticleLimit', 'minimumSize', 'maximumSize', 'fallSpeed', 'opacity', 'colours', 'excludedRoutes']) {
  assert.match(script, new RegExp(`${key}:`), `Central configuration must contain ${key}`);
}
assert.match(home, /css\/snowfall\.css/);
assert.match(home, /js\/snowfall\.js/);
assert.match(offers, /css\/snowfall\.css/);
assert.match(offers, /js\/snowfall\.js/);
assert.doesNotMatch(home + offers + script + styles, /star-canvas|initStarField/);
excludedPages.forEach((file) => assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /snowfall\.(?:css|js)/, `${file} must remain excluded`));

assert.match(styles, /\.zyntra-snowfall\{[\s\S]*position:fixed[\s\S]*inset:0[\s\S]*pointer-events:none/);
assert.match(styles, /@media print\{[\s\S]*\.zyntra-snowfall\{display:none!important\}/);
assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);
assert.match(script, /canvas\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(script, /data-html2canvas-ignore/);
assert.match(script, /for \(var branch = 0; branch < 6; branch \+= 1\)/);
assert.match(script, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
assert.match(script, /document\.hidden/);
assert.match(script, /lastTime = performance\.now\(\)/);
assert.match(script, /function destroy\(\)[\s\S]*cancelAnimationFrame[\s\S]*listeners\.pop\(\)\(\)[\s\S]*canvas\.remove\(\)/);
assert.doesNotMatch(script, /❄|☃|emoji/i);

let canvases = 0;
let mediaListeners = 0;
const media = { matches: false, addEventListener() { mediaListeners += 1; }, removeEventListener() { mediaListeners -= 1; } };
const disabledSource = script.replace('enabled: true', 'enabled: false');
const context = {
  window: {
    location: { pathname: '/index.html' },
    matchMedia: () => media,
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1
  },
  document: {
    readyState: 'complete', hidden: false, body: {},
    querySelector() { return null; },
    createElement() { canvases += 1; return {}; },
    addEventListener() {}, removeEventListener() {}
  },
  performance: { now: () => 0 },
  MutationObserver: function () {},
  Math, JSON, Object, Array
};
context.window.window = context.window;
context.window.document = context.document;
vm.createContext(context);
vm.runInContext(disabledSource, context);
assert.equal(canvases, 0, 'enabled:false must not create a canvas');
assert.equal(mediaListeners, 0, 'enabled:false must not retain preference listeners');
assert.equal(context.window.ZyntraSnowfall.getState().enabled, false);

console.log('Snowfall architecture, public coverage, exclusions and disable contract tests: PASS');
