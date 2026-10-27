const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('js/cursor-effects.js', 'utf8');
const styles = fs.readFileSync('css/cursor-effects.css', 'utf8');
const mainScript = fs.readFileSync('script.js', 'utf8');
const mainStyles = fs.readFileSync('style.css', 'utf8');

for (const property of ['enabled', 'glowColour', 'particleColours', 'particleCountLimit', 'particleLifetime', 'glowSize', 'hoverIntensity', 'clickRippleEnabled']) {
  assert.match(script, new RegExp(`\\b${property}:`), `Missing central configuration property: ${property}`);
}
assert.match(script, /if \(!CURSOR_EFFECT_CONFIG\.enabled \|\| reducedMotionQuery\.matches \|\| !finePointerQuery\.matches/);
assert.ok(script.indexOf('if (!CURSOR_EFFECT_CONFIG.enabled') < script.indexOf("document.createElement('canvas')"), 'Feature gates must run before canvas creation');
assert.ok(script.indexOf('if (!CURSOR_EFFECT_CONFIG.enabled') < script.indexOf("listen(hero, 'pointermove'"), 'Feature gates must run before listeners');

assert.match(html, /<link rel="stylesheet" href="css\/cursor-effects\.css">/);
assert.match(html, /<script src="js\/cursor-effects\.js"><\/script>/);
assert.match(styles, /\.zyntra-cursor-effects\{[\s\S]*position:absolute[\s\S]*pointer-events:none/);
assert.match(styles, /@media \(hover:none\),\(pointer:coarse\),\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(styles, /cursor\s*:/, 'The system cursor must remain unchanged');
assert.match(script, /canvas\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(script, /hero\.appendChild\(canvas\)/, 'Canvas must remain scoped to the hero');

assert.match(script, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
assert.match(script, /requestAnimationFrame\(render\)/);
assert.match(script, /particleCountLimit/);
assert.match(script, /if \(!particles\[i\]\.active\) return particles\[i\]/, 'Particle objects must be reused');
assert.match(script, /if \(time - lastEmitTime < 24 \|\| distance < 7\) return/, 'Stationary pointers must not emit particles');
assert.match(script, /IntersectionObserver/);
assert.match(script, /visibilitychange/);
assert.match(script, /if \(hasVisibleEffect\) frameId = window\.requestAnimationFrame\(render\);\s*else clearAndStop\(\)/);
assert.match(script, /function destroy\(\)[\s\S]*removeListener[\s\S]*canvas\.remove\(\)/);
assert.match(script, /MutationObserver/);

assert.doesNotMatch(mainScript, /createSparkBurst|spark-burst|spark-particle/);
assert.doesNotMatch(mainStyles, /\.spark-burst|\.spark-particle|@keyframes sparkCore|@keyframes sparkFall/);

let listeners = 0;
let canvases = 0;
const disabledScript = script.replace('enabled: true', 'enabled: false');
const context = {
  window: {
    matchMedia: () => ({ matches: false, addEventListener: () => { listeners += 1; } })
  },
  document: {
    getElementById: () => null,
    createElement: () => { canvases += 1; return {}; }
  }
};
vm.createContext(context);
vm.runInContext(disabledScript, context);
assert.equal(listeners, 0, 'enabled:false must not start listeners');
assert.equal(canvases, 0, 'enabled:false must not create a canvas');
assert.equal(context.window.ZyntraCursorEffects.getState().enabled, false);

console.log('Hero cursor effect architecture tests: PASS');
