'use strict';

const assert = require('node:assert/strict');

async function connectCdp() {
  const version = await fetch('http://127.0.0.1:9223/json/version').then((response) => response.json());
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let id = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text || 'Runtime exception');
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
      return;
    }
    if (!pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return {
    socket,
    errors,
    send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
  };
}

async function createPage(cdp, options) {
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const session = attached.sessionId;
  const send = (method, params = {}) => cdp.send(method, params, session);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', options.metrics);
  if (options.touch) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (options.reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/index.html#home' });
  await waitFor(`document.readyState === 'complete' && window.ZyntraCursorEffects`);
  return { targetId: target.targetId, send, evaluate, waitFor };
}

async function run() {
  const cdp = await connectCdp();
  const desktop = await createPage(cdp, { metrics: { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false } });
  const initial = await desktop.evaluate(`(() => {
    const hero = document.querySelector('#home');
    const canvas = document.querySelector('.zyntra-cursor-effects');
    const rect = hero.getBoundingClientRect();
    return { canvasCount: document.querySelectorAll('.zyntra-cursor-effects').length, parent: canvas && canvas.parentElement.id, aria: canvas && canvas.getAttribute('aria-hidden'), pointerEvents: canvas && getComputedStyle(canvas).pointerEvents, cursor: getComputedStyle(hero).cursor, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
  })()`);
  assert.equal(initial.canvasCount, 1);
  assert.equal(initial.parent, 'home');
  assert.equal(initial.aria, 'true');
  assert.equal(initial.pointerEvents, 'none');
  assert.notEqual(initial.cursor, 'none');

  const startX = initial.rect.left + initial.rect.width * 0.28;
  const startY = Math.max(initial.rect.top + 120, 220);
  for (let step = 0; step < 8; step += 1) {
    await desktop.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX + step * 14, y: startY + step * 5, button: 'none', pointerType: 'mouse' });
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  let state = await desktop.evaluate(`window.ZyntraCursorEffects.getState()`);
  assert.equal(state.pointerInside, true);
  assert.ok(state.particles > 0 && state.particles <= 34, 'Movement should create a short capped trail');
  assert.ok(await desktop.evaluate(`(() => { const canvas = document.querySelector('.zyntra-cursor-effects'); const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true; return false; })()`), 'Canvas should render visible glow or particle pixels');

  await new Promise((resolve) => setTimeout(resolve, 650));
  state = await desktop.evaluate(`window.ZyntraCursorEffects.getState()`);
  assert.equal(state.particles, 0, 'Particles must stop spawning and expire while stationary');

  const button = await desktop.evaluate(`(() => { const rect = document.querySelector('#home .btn-primary').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
  await desktop.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: button.x, y: button.y, button: 'none', pointerType: 'mouse' });
  state = await desktop.evaluate(`window.ZyntraCursorEffects.getState()`);
  assert.equal(state.hoveredControl, true, 'Links and buttons should strengthen the glow');
  assert.equal(await desktop.evaluate(`document.elementFromPoint(${button.x}, ${button.y}).closest('a,button') !== null`), true, 'Canvas must not block controls');

  await desktop.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  state = await desktop.evaluate(`window.ZyntraCursorEffects.getState()`);
  assert.ok(state.ripples > 0, 'Primary clicks should create one restrained ripple');
  await desktop.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX, y: startY, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });

  await desktop.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 8, button: 'none', pointerType: 'mouse' });
  await new Promise((resolve) => setTimeout(resolve, 850));
  state = await desktop.evaluate(`window.ZyntraCursorEffects.getState()`);
  assert.equal(state.pointerInside, false);
  assert.equal(state.running, false, 'Animation loop should stop after the effect fades');

  const oldBitmap = await desktop.evaluate(`document.querySelector('.zyntra-cursor-effects').width`);
  await desktop.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
  await new Promise((resolve) => setTimeout(resolve, 120));
  const resized = await desktop.evaluate(`(() => { const canvas = document.querySelector('.zyntra-cursor-effects'); const hero = document.querySelector('#home'); return { bitmap: canvas.width, heroWidth: hero.clientWidth, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }; })()`);
  assert.notEqual(resized.bitmap, oldBitmap);
  assert.equal(resized.bitmap, resized.heroWidth);
  assert.ok(resized.scrollWidth <= resized.viewport, 'Effect must not create horizontal overflow');

  await desktop.evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('#custom-package-builder').scrollIntoView({ behavior: 'auto' }); })()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  state = await desktop.evaluate(`window.ZyntraCursorEffects.getState()`);
  assert.equal(state.heroVisible, false);
  assert.equal(state.running, false, 'Rendering must pause when the hero is off-screen');

  await desktop.evaluate(`window.ZyntraCursorEffects.destroy()`);
  assert.equal(await desktop.evaluate(`document.querySelectorAll('.zyntra-cursor-effects').length`), 0);
  assert.equal((await desktop.evaluate(`window.ZyntraCursorEffects.getState()`)).enabled, false);

  const mobile = await createPage(cdp, { metrics: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, touch: true });
  const mobileState = await mobile.evaluate(`({ canvas: document.querySelectorAll('.zyntra-cursor-effects').length, fine: matchMedia('(hover: hover) and (pointer: fine)').matches, overflow: document.documentElement.scrollWidth <= innerWidth })`);
  assert.equal(mobileState.fine, false);
  assert.equal(mobileState.canvas, 0, 'Touch-first devices must not create the effect');
  assert.equal(mobileState.overflow, true);

  const reduced = await createPage(cdp, { metrics: { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false }, reduced: true });
  assert.equal(await reduced.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`), true);
  assert.equal(await reduced.evaluate(`document.querySelectorAll('.zyntra-cursor-effects').length`), 0, 'Reduced motion must fully disable the effect');
  assert.deepEqual(cdp.errors, [], 'Cursor verification must not produce console errors');

  await cdp.send('Target.closeTarget', { targetId: desktop.targetId });
  await cdp.send('Target.closeTarget', { targetId: mobile.targetId });
  await cdp.send('Target.closeTarget', { targetId: reduced.targetId });
  cdp.socket.close();
  console.log('Hero cursor desktop, touch, reduced-motion and lifecycle checks: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
