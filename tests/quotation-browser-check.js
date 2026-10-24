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
  async function navigate(url) {
    await send('Page.navigate', { url });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate('document.readyState === "complete"')) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Timed out loading ' + url);
  }
  async function printPageCount() {
    const result = await send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false
    });
    const source = Buffer.from(result.data, 'base64').toString('latin1');
    const counts = Array.from(source.matchAll(/\/Count\s+(\d+)/g), (match) => Number(match[1]));
    return counts.length ? Math.max(...counts) : 0;
  }

  await navigate('http://127.0.0.1:4173/index.html#build-your-package');
  const initial = await evaluate(`(() => ({
    instruction: document.querySelector('#custom-package-total').textContent,
    resultHidden: document.querySelector('#custom-package-result').hidden,
    quotationHidden: document.querySelector('#custom-package-download').hidden,
    quotationDisabled: document.querySelector('#custom-package-download').disabled
  }))()`);
  assert.match(initial.instruction, /shown after you create/);
  assert.equal(initial.resultHidden, true);
  assert.equal(initial.quotationHidden, true);
  assert.equal(initial.quotationDisabled, true);

  await evaluate(`(() => {
    const input = document.querySelector('#custom-post-count');
    input.value = '20'; input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  assert.match(await evaluate(`document.querySelector('#custom-package-total').textContent`), /shown after you create/);
  await evaluate(`document.querySelector('#custom-package-form').requestSubmit()`);
  const firstGenerated = await evaluate(`(() => {
    const snapshot = JSON.parse(sessionStorage.getItem('zyntra.customPackageQuotation.v1'));
    return { total: snapshot.total, reference: snapshot.reference, issue: snapshot.issueDate, expiry: snapshot.expiryDate,
      card: document.querySelector('#custom-card-total').textContent, actionDisabled: document.querySelector('#custom-package-download').disabled };
  })()`);
  assert.equal(firstGenerated.total, 18000);
  assert.equal(firstGenerated.card, 'Rs. 18,000');
  assert.equal(firstGenerated.actionDisabled, false);

  await evaluate(`(() => { const input = document.querySelector('#custom-post-count'); input.value='21'; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  const dirty = await evaluate(`(() => ({
    notice: document.querySelector('#custom-package-total').textContent,
    resultHidden: document.querySelector('#custom-package-result').hidden,
    disabled: document.querySelector('#custom-package-download').disabled,
    storedTotal: JSON.parse(sessionStorage.getItem('zyntra.customPackageQuotation.v1')).total
  }))()`);
  assert.match(dirty.notice, /selections have changed/);
  assert.equal(dirty.resultHidden, true);
  assert.equal(dirty.disabled, true);
  assert.equal(dirty.storedTotal, 18000);

  await evaluate(`(() => { const input=document.querySelector('#custom-post-count'); input.value='20'; input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#custom-package-form').requestSubmit(); })()`);
  const regeneratedReference = await evaluate(`JSON.parse(sessionStorage.getItem('zyntra.customPackageQuotation.v1')).reference`);
  assert.notEqual(regeneratedReference, firstGenerated.reference);

  await evaluate(`document.querySelector('#custom-package-download').click()`);
  for (let attempt = 0; attempt < 100 && !(await evaluate(`location.pathname.endsWith('/quotation.html') && document.querySelector('#quotation-document') && !document.querySelector('#quotation-document').hidden`)); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const postsOnly = await evaluate(`(() => ({
    title: document.title,
    rows: document.querySelectorAll('#quotation-services tr').length,
    total: document.querySelector('#quotation-total').textContent,
    includedHidden: document.querySelector('#quotation-included-section').hidden,
    adNotice: document.querySelector('#quotation-advertising-notice').textContent,
    reference: document.querySelector('#quotation-reference').textContent,
    amountCount: (document.body.innerText.match(/Rs\\. \\d/g) || []).length
  }))()`);
  assert.equal(postsOnly.rows, 1);
  assert.equal(postsOnly.total, 'Rs. 18,000');
  assert.equal(postsOnly.includedHidden, true);
  assert.match(postsOnly.adNotice, /ad boosting management are not included/);
  assert.equal(postsOnly.reference, regeneratedReference);
  assert.equal(postsOnly.amountCount, 1);
  assert.equal(await printPageCount(), 1, 'A short quotation should print on one A4 page');

  await send('Page.reload', { ignoreCache: true });
  for (let attempt = 0; attempt < 100 && !(await evaluate(`document.readyState === 'complete'`)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(await evaluate(`document.querySelector('#quotation-reference').textContent`), regeneratedReference);

  await navigate('http://127.0.0.1:4173/index.html#build-your-package');
  const restored = await evaluate(`(() => ({ value: document.querySelector('#custom-post-count').value, card: document.querySelector('#custom-card-total').textContent, hidden: document.querySelector('#custom-package-result').hidden }))()`);
  assert.deepEqual(restored, { value: '20', card: 'Rs. 18,000', hidden: false });

  await evaluate(`(() => {
    const posts=document.querySelector('#custom-post-count'); posts.value='1'; posts.dispatchEvent(new Event('input',{bubbles:true}));
    const management=document.querySelector('#custom-management-enabled'); management.checked=true; management.dispatchEvent(new Event('change',{bubbles:true}));
    const facebook=document.querySelector('input[name="custom-platform"][value="Facebook"]'); facebook.checked=true; facebook.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#custom-package-form').requestSubmit();
    document.querySelector('#custom-package-download').click();
  })()`);
  for (let attempt = 0; attempt < 100 && !(await evaluate(`location.pathname.endsWith('/quotation.html') && document.querySelector('#quotation-document') && !document.querySelector('#quotation-document').hidden`)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  const managementQuote = await evaluate(`(() => ({ included: document.querySelector('#quotation-included').innerText, notice: document.querySelector('#quotation-advertising-notice').textContent, label: document.querySelector('#quotation-total-label').textContent }))()`);
  assert.match(managementQuote.included, /Content scheduling/);
  assert.match(managementQuote.included, /Page maintenance/);
  assert.match(managementQuote.included, /Ad boosting support/);
  assert.match(managementQuote.notice, /support is included/);
  assert.equal(managementQuote.label, 'MONTHLY PACKAGE TOTAL');

  await navigate('http://127.0.0.1:4173/index.html#build-your-package');
  await evaluate(`(() => {
    const posts=document.querySelector('#custom-post-count'); posts.value='0'; posts.dispatchEvent(new Event('input',{bubbles:true}));
    const management=document.querySelector('#custom-management-enabled'); management.checked=false; management.dispatchEvent(new Event('change',{bubbles:true}));
    const youtube=document.querySelector('#custom-youtube-enabled'); youtube.checked=true; youtube.dispatchEvent(new Event('change',{bubbles:true}));
    const basic=document.querySelector('input[name="custom-youtube-editing-type"][value="basic"]'); basic.checked=true; basic.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#custom-package-form').requestSubmit(); document.querySelector('#custom-package-download').click();
  })()`);
  for (let attempt = 0; attempt < 100 && !(await evaluate(`location.pathname.endsWith('/quotation.html') && document.querySelector('#quotation-document') && !document.querySelector('#quotation-document').hidden`)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  const quoteOnly = await evaluate(`(() => ({ total: document.querySelector('#quotation-total').textContent, amounts: (document.body.innerText.match(/Rs\\./g)||[]).length, quoteNotice: document.querySelector('#quotation-quote-only-notice').hidden }))()`);
  assert.equal(quoteOnly.total, 'Custom quote required');
  assert.equal(quoteOnly.amounts, 0);
  assert.equal(quoteOnly.quoteNotice, false);

  await navigate('http://127.0.0.1:4173/index.html#build-your-package');
  await evaluate(`(() => {
    ['custom-post-count','custom-video-25-count','custom-video-50-count','custom-story-count','custom-ai-video-45-count','custom-ai-video-90-count'].forEach(id => {
      const input=document.getElementById(id); input.value='1'; input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const management=document.querySelector('#custom-management-enabled'); management.checked=true; management.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelectorAll('input[name="custom-platform"]').forEach(input => { input.checked=true; input.dispatchEvent(new Event('change',{bubbles:true})); });
    for(let index=1; index<20; index+=1) document.querySelector('#custom-youtube-increase').click();
    document.querySelectorAll('input[name="custom-youtube-addon"]').forEach(input => { input.checked=true; input.dispatchEvent(new Event('change',{bubbles:true})); });
    document.querySelector('#custom-package-form').requestSubmit(); document.querySelector('#custom-package-download').click();
  })()`);
  for (let attempt = 0; attempt < 100 && !(await evaluate(`location.pathname.endsWith('/quotation.html') && document.querySelector('#quotation-document') && !document.querySelector('#quotation-document').hidden`)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  const longQuote = await evaluate(`(() => ({ rows: document.querySelectorAll('#quotation-services tr').length, aiRows: Array.from(document.querySelectorAll('#quotation-services tr')).filter(row => row.firstChild.textContent === 'AI Videos').length, youtubeDetails: document.querySelector('#quotation-services tr:last-child td:last-child').textContent, amounts: (document.body.innerText.match(/Rs\\./g)||[]).length }))()`);
  assert.equal(longQuote.rows, 8);
  assert.equal(longQuote.aiRows, 2);
  assert.match(longQuote.youtubeDetails, /20 videos/);
  assert.equal(longQuote.amounts, 1);
  const longPages = await printPageCount();
  assert.ok(longPages >= 2, 'A long quotation should flow to at least two A4 pages');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobileLayout = await evaluate(`(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, tableWidth: document.querySelector('.quotation-services table').getBoundingClientRect().width }))()`);
  assert.equal(mobileLayout.viewport, 390);
  assert.ok(mobileLayout.scrollWidth <= mobileLayout.viewport, 'Mobile quotation must not overflow horizontally');
  assert.ok(mobileLayout.tableWidth <= mobileLayout.viewport, 'Service table must fit the mobile viewport');
  await send('Emulation.clearDeviceMetricsOverride');

  await evaluate(`document.querySelector('#quotation-services tr:last-child td:last-child').textContent += ' ' + 'Extended selected requirement details. '.repeat(300)`);
  const exceptionalPages = await printPageCount();
  assert.ok(exceptionalPages >= 3, 'Exceptionally long selected details should continue beyond two pages without a hard limit');

  await evaluate(`(() => { const value=JSON.parse(sessionStorage.getItem('zyntra.customPackageQuotation.v1')); value.issueDate='2020-01-01'; value.expiryDate='2020-01-29'; sessionStorage.setItem('zyntra.customPackageQuotation.v1',JSON.stringify(value)); })()`);
  await send('Page.reload', { ignoreCache: true });
  for (let attempt = 0; attempt < 100 && !(await evaluate(`document.readyState === 'complete' && document.querySelector('#quotation-expired')`)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(await evaluate(`document.querySelector('#quotation-expired').hidden`), false, 'Expired quotations must be marked clearly');

  await evaluate(`sessionStorage.setItem('zyntra.customPackageQuotation.v1','{"version":1,"broken":true}')`);
  await send('Page.reload', { ignoreCache: true });
  for (let attempt = 0; attempt < 100 && !(await evaluate(`document.readyState === 'complete' && document.querySelector('#quotation-message')`)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(await evaluate(`document.querySelector('#quotation-message').hidden`), false, 'Malformed snapshots must show the recovery message');

  await evaluate(`sessionStorage.removeItem('zyntra.customPackageQuotation.v1')`);
  await send('Page.reload', { ignoreCache: true });
  for (let attempt = 0; attempt < 100 && !(await evaluate(`document.readyState === 'complete' && document.querySelector('#quotation-message')`)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.match(await evaluate(`document.querySelector('#quotation-message-text').textContent`), /No generated quotation was found/);

  cdp.socket.close();
  console.log(JSON.stringify({ status: 'PASS', shortPages: 1, longPages, exceptionalPages, checked: ['initial gating', 'no live total', 'dirty snapshot', 'regeneration', 'posts-only', 'management', 'AI selections', 'quote-only YouTube', 'refresh stability', 'builder restoration', 'multi-page print', 'mobile overflow', 'expired state', 'missing/malformed recovery'] }));
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
