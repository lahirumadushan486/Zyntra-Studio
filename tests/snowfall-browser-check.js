'use strict';

const assert = require('node:assert/strict');

async function connectCdp() {
  const version = await fetch('http://127.0.0.1:9223/json/version').then((response) => response.json());
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  return { socket, send };
}

async function run() {
  const cdp = await connectCdp();
  const errors = [];
  cdp.socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  });
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const session = attached.sessionId;
  const send = (method, params = {}) => cdp.send(method, params, session);
  await send('Page.enable');
  await send('Runtime.enable');

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function navigate(path) {
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/' + path });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (await evaluate(`document.readyState === 'complete'`)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Timed out loading ' + path);
  }
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Timed out waiting for ' + expression);
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
  await navigate('index.html');
  await waitFor(`window.ZyntraSnowfall && document.querySelector('.zyntra-snowfall')`);
  let state = await evaluate(`(() => { const c=document.querySelector('.zyntra-snowfall'); const r=c.getBoundingClientRect(); const api=ZyntraSnowfall.getState(); return { count:document.querySelectorAll('.zyntra-snowfall').length, position:getComputedStyle(c).position, pointer:getComputedStyle(c).pointerEvents, aria:c.getAttribute('aria-hidden'), width:r.width, height:r.height, bitmapWidth:c.width, particles:api.particleCount, frame:api.frameScheduled, overflow:document.documentElement.scrollWidth<=innerWidth }; })()`);
  assert.deepEqual({ count: state.count, position: state.position, pointer: state.pointer, aria: state.aria }, { count: 1, position: 'fixed', pointer: 'none', aria: 'true' });
  assert.equal(state.width, 1280);
  assert.equal(state.height, 800);
  assert.ok(state.bitmapWidth <= 1280 * 1.5, 'Pixel density must be capped');
  assert.equal(state.particles, 68);
  assert.equal(state.frame, true);
  assert.equal(state.overflow, true);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(await evaluate(`(() => { const c=document.querySelector('.zyntra-snowfall'); const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data; for(let i=3;i<data.length;i+=4) if(data[i]>0) return true; return false; })()`), true, 'Canvas must contain visible snowfall pixels');
  assert.equal(await evaluate(`document.elementFromPoint(20,20).classList.contains('zyntra-snowfall')`), false, 'Snowfall must not intercept hit testing');
  assert.equal(await evaluate(`Number(getComputedStyle(document.querySelector('.site-header')).zIndex) > Number(getComputedStyle(document.querySelector('.zyntra-snowfall')).zIndex)`), true, 'Navigation must remain above snowfall');
  await evaluate(`document.querySelector('#custom-package-create').scrollIntoView({block:'center',behavior:'instant'})`);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(await evaluate(`(() => { const target=document.querySelector('#custom-package-create'); const r=target.getBoundingClientRect(); const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return Boolean(hit && hit.closest('#custom-package-create')); })()`), true, 'Package calculator controls must remain the hit-test target');
  await evaluate(`scrollTo(0, document.documentElement.scrollHeight * .65)`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.querySelector('.zyntra-snowfall').getBoundingClientRect().top`), 0, 'Canvas must remain fixed while scrolling');

  await navigate('offers.html');
  await waitFor(`window.ZyntraSnowfall && document.querySelector('.zyntra-snowfall')`);
  assert.equal(await evaluate(`document.querySelectorAll('.zyntra-snowfall').length`), 1, 'Offers page must use one canvas');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await navigate('index.html');
  await waitFor(`window.ZyntraSnowfall && document.querySelector('.zyntra-snowfall')`);
  state = await evaluate(`({ particles:ZyntraSnowfall.getState().particleCount, bitmap:document.querySelector('.zyntra-snowfall').width, overflow:document.documentElement.scrollWidth<=innerWidth })`);
  assert.equal(state.particles, 30);
  assert.ok(state.bitmap <= 390 * 1.5);
  assert.equal(state.overflow, true);

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor(`document.querySelectorAll('.zyntra-snowfall').length === 0`);
  assert.equal((await evaluate(`ZyntraSnowfall.getState()`)).enabled, false);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await waitFor(`document.querySelectorAll('.zyntra-snowfall').length === 1`);

  await evaluate(`ZyntraSnowfall.destroy()`);
  assert.equal(await evaluate(`document.querySelectorAll('.zyntra-snowfall').length`), 0);
  assert.equal((await evaluate(`ZyntraSnowfall.getState()`)).frameScheduled, false);

  await navigate('quotation.html');
  assert.equal(await evaluate(`document.querySelectorAll('.zyntra-snowfall').length`), 0, 'Printable quotations must not load snowfall');
  await navigate('portal-access.html');
  assert.equal(await evaluate(`document.querySelectorAll('.zyntra-snowfall').length`), 0, 'Portal access must not load snowfall');
  assert.deepEqual(errors, [], 'Snowfall checks must not produce runtime errors');

  cdp.socket.close();
  console.log('Snowfall public-page, scroll, mobile, reduced-motion, exclusion and lifecycle checks: PASS');
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
