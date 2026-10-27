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
  return {
    socket,
    send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
  };
}

async function run() {
  const cdp = await connectCdp();
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const session = attached.sessionId;
  const send = (method, params = {}) => cdp.send(method, params, session);
  await send('Page.enable');
  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/index.html#custom-package-builder' });
  await waitFor(`document.readyState === 'complete' && document.querySelector('#custom-coupon-code')`);

  await evaluate(`(() => {
    const set = (id, value) => { const input = document.querySelector(id); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
    set('#custom-post-count', '10'); set('#custom-video-50-count', '10');
    const coupon = document.querySelector('#custom-coupon-code'); coupon.value = '  zscno750  ';
    document.querySelector('#custom-coupon-apply').click();
  })()`);
  let state = await evaluate(`(() => ({ code: document.querySelector('#custom-coupon-code').value, total: document.querySelector('#custom-package-total').textContent, resultHidden: document.querySelector('#custom-package-result').hidden, status: document.querySelector('#custom-coupon-status').textContent }))()`);
  assert.equal(state.code, 'ZSCNO750');
  assert.match(state.status, /applied/);
  assert.equal(state.resultHidden, true);
  assert.match(state.total, /shown after you create/);

  await evaluate(`document.querySelector('#custom-package-form').requestSubmit()`);
  state = await evaluate(`(() => ({ original: document.querySelector('#custom-card-original-total').textContent, discount: document.querySelector('#custom-card-coupon-discount').textContent, discountLabel: document.querySelector('#custom-card-coupon-label').textContent, finalLabel: document.querySelector('#custom-card-total-label').textContent, final: document.querySelector('#custom-card-total').textContent, cardText: document.querySelector('#custom-package-card').innerText }))()`);
  assert.deepEqual({ original: state.original, discount: state.discount, discountLabel: state.discountLabel, finalLabel: state.finalLabel, final: state.final }, { original: 'Rs. 40,000', discount: '−Rs. 750', discountLabel: 'COUPON DISCOUNT', finalLabel: 'FINAL PACKAGE TOTAL', final: 'Rs. 39,250' });
  assert.doesNotMatch(state.cardText, /ZSCNO750/);

  await evaluate(`(() => { const input = document.querySelector('#custom-coupon-code'); input.value = 'ZSCNO2750'; document.querySelector('#custom-coupon-apply').click(); })()`);
  state = await evaluate(`(() => ({ hidden: document.querySelector('#custom-package-result').hidden, total: document.querySelector('#custom-package-total').textContent }))()`);
  assert.equal(state.hidden, true);
  assert.match(state.total, /update your quotation/);
  await evaluate(`document.querySelector('#custom-package-form').requestSubmit()`);
  assert.equal(await evaluate(`document.querySelector('#custom-card-total').textContent`), 'Rs. 37,250');

  await evaluate(`document.querySelector('#custom-coupon-remove').click()`);
  assert.equal(await evaluate(`document.querySelector('#custom-package-result').hidden`), true);
  await evaluate(`document.querySelector('#custom-package-form').requestSubmit()`);
  assert.equal(await evaluate(`document.querySelector('#custom-card-total').textContent`), 'Rs. 40,000');

  await evaluate(`(() => { const input = document.querySelector('#custom-coupon-code'); input.value = 'ZSCNO30000'; document.querySelector('#custom-coupon-apply').click(); document.querySelector('#custom-package-form').requestSubmit(); })()`);
  assert.equal(await evaluate(`document.querySelector('#custom-card-total').textContent`), 'Rs. 10,000');

  await evaluate(`document.querySelector('#custom-package-download').click()`);
  await waitFor(`location.pathname.endsWith('/quotation.html') && document.querySelector('#quotation-document') && !document.querySelector('#quotation-document').hidden`);
  state = await evaluate(`(() => ({ original: document.querySelector('#quotation-original-total').textContent, discount: document.querySelector('#quotation-coupon-discount').textContent, discountLabel: document.querySelector('#quotation-coupon-label').textContent, finalLabel: document.querySelector('#quotation-total-label').textContent, final: document.querySelector('#quotation-total').textContent, documentText: document.querySelector('#quotation-document').innerText, title: document.title }))()`);
  assert.deepEqual({ original: state.original, discount: state.discount, discountLabel: state.discountLabel, finalLabel: state.finalLabel, final: state.final }, { original: 'Rs. 40,000', discount: '−Rs. 30,000', discountLabel: 'COUPON DISCOUNT', finalLabel: 'FINAL PACKAGE TOTAL', final: 'Rs. 10,000' });
  assert.doesNotMatch(state.documentText + state.title, /ZSCNO30000/);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/index.html#custom-package-builder' });
  await waitFor(`document.readyState === 'complete' && document.querySelector('#custom-coupon-code')`);
  state = await evaluate(`(() => { const controls = document.querySelector('.custom-package-builder__coupon-controls').getBoundingClientRect(); return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, left: controls.left, right: controls.right }; })()`);
  assert.ok(state.scrollWidth <= state.viewport, 'Mobile builder must not overflow horizontally');
  assert.ok(state.left >= 0 && state.right <= state.viewport, 'Coupon controls must fit the mobile viewport');

  await evaluate(`(() => { const set = (id, value) => { const input = document.querySelector(id); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }; set('#custom-post-count', '1'); set('#custom-video-25-count', '0'); set('#custom-video-50-count', '0'); set('#custom-story-count', '0'); set('#custom-ai-video-45-count', '0'); set('#custom-ai-video-90-count', '0'); const coupon = document.querySelector('#custom-coupon-code'); coupon.value = 'ZSCNO1000'; document.querySelector('#custom-coupon-apply').click(); })()`);
  assert.equal(await evaluate(`document.querySelector('#custom-coupon-status').textContent`), 'This coupon requires a package total higher than its discount value.');

  await cdp.send('Target.closeTarget', { targetId: target.targetId });
  cdp.socket.close();
  console.log('Desktop/mobile coupon browser checks: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
