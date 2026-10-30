'use strict';

const assert = require('node:assert/strict');

(async function () {
  const schema = await import('../js/quotation-schema.js');
  const baseSelection = {
    quantities: { posts: 0, video25: 0, video50: 0, stories: 0, aiVideo45: 0, aiVideo90: 0 },
    platforms: [],
    management: false,
    youtube: { enabled: false, videos: [{ durationMinutes: 1 }], editingType: '', addOns: [] },
    coupon: null
  };

  const expectedPostTotals = new Map([[0, 0], [1, 1000], [10, 10000], [11, 10900], [19, 18100], [20, 18000], [21, 18900]]);
  expectedPostTotals.forEach(function (total, quantity) { assert.equal(schema.calculateStaticPostsPrice(quantity), total); });

  const mixed = JSON.parse(JSON.stringify(baseSelection));
  Object.assign(mixed.quantities, { posts: 11, video25: 1, video50: 1, stories: 1, aiVideo45: 1, aiVideo90: 1 });
  mixed.management = true;
  mixed.platforms = ['Facebook', 'Instagram'];
  mixed.youtube = { enabled: true, videos: [{ durationMinutes: 5 }, { durationMinutes: 12 }], editingType: 'advanced', addOns: ['thumbnail', 'subtitles'] };
  mixed.coupon = { code: 'ZSCNO750', amount: 750 };
  const snapshot = schema.createQuotationSnapshot({ reference: 'ZS-Q-TEST-MIXED', issueDate: '2026-10-30', selection: mixed, discountAmount: 750 });
  assert.ok(snapshot);
  assert.deepEqual(snapshot.services.map(function (service) { return service.id; }), ['posts', 'video25', 'video50', 'stories', 'aiVideo45', 'aiVideo90', 'management', 'youtube']);
  assert.equal(snapshot.totals.original, 34300);
  assert.equal(snapshot.totals.final, 33550);
  assert.equal(JSON.stringify(snapshot).includes('ZSCNO750'), false, 'Printable snapshot must not expose the coupon code');
  assert.ok(schema.normalizeAndValidateQuotationSnapshot(snapshot));

  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.totals.final += 1;
  assert.equal(schema.normalizeAndValidateQuotationSnapshot(tampered), null);

  const aiOnly = JSON.parse(JSON.stringify(baseSelection));
  aiOnly.quantities.aiVideo45 = 1;
  assert.ok(schema.createQuotationSnapshot({ reference: 'ZS-Q-AI', issueDate: '2026-10-30', selection: aiOnly, discountAmount: 0 }));

  assert.equal(schema.createQuotationSnapshot({ reference: 'ZS-Q-EMPTY', issueDate: '2026-10-30', selection: baseSelection, discountAmount: 0 }), null);
  const storyOnly = JSON.parse(JSON.stringify(baseSelection));
  storyOnly.quantities.stories = 1;
  assert.equal(schema.createQuotationSnapshot({ reference: 'ZS-Q-STORY', issueDate: '2026-10-30', selection: storyOnly, discountAmount: 0 }), null);
  const managementWithoutPlatform = JSON.parse(JSON.stringify(aiOnly));
  managementWithoutPlatform.management = true;
  assert.equal(schema.createQuotationSnapshot({ reference: 'ZS-Q-MGMT', issueDate: '2026-10-30', selection: managementWithoutPlatform, discountAmount: 0 }), null);

  const youtubeOnly = JSON.parse(JSON.stringify(baseSelection));
  youtubeOnly.youtube = { enabled: true, videos: [{ durationMinutes: 15 }], editingType: 'professional', addOns: [] };
  const quoteOnly = schema.createQuotationSnapshot({ reference: 'ZS-Q-YT', issueDate: '2026-10-30', selection: youtubeOnly, discountAmount: 0 });
  assert.equal(quoteOnly.quoteOnly, true);
  assert.equal(quoteOnly.totals.final, 0);

  console.log('Shared quotation schema, pricing, normalization and tamper tests: PASS');
}()).catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
