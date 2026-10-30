export const QUOTATION_VERSION = 2;
export const QUOTATION_STORAGE_PREFIX = 'zyntra.customPackageQuotation.v2.';
export const LEGACY_QUOTATION_STORAGE_KEY = 'zyntra.customPackageQuotation.v1';

export const QUOTATION_PRICING = Object.freeze({
  managementFirstPlatform: 7000,
  managementAdditionalPlatform: 1000,
  staticPosts: Object.freeze({ standardRate: 1000, bulkRate: 900, bulkRateStartsAt: 11, fullOrderBulkRateStartsAt: 20 }),
  video25: 2000,
  video50: 3000,
  story: 1400,
  aiVideo45: 3500,
  aiVideo90: 5500,
  maximumQuantity: 999
});

const ALLOWED_PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'YouTube'];
const EDITING_LABELS = Object.freeze({ basic: 'Basic Editing', professional: 'Professional Editing', advanced: 'Advanced Editing' });
const ADDON_LABELS = Object.freeze({ thumbnail: 'Thumbnail Design', subtitles: 'Subtitles', introOutro: 'Intro / Outro', motionGraphics: 'Motion Graphics' });
const QUANTITY_KEYS = ['posts', 'video25', 'video50', 'stories', 'aiVideo45', 'aiVideo90'];

function isSafeString(value, maximum) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

export function addQuotationDays(isoDate, days) {
  if (!isIsoDate(isoDate)) return '';
  const parts = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
}

export function calculateStaticPostsPrice(quantity) {
  const count = Math.max(0, Math.floor(Number(quantity) || 0));
  const standardLimit = QUOTATION_PRICING.staticPosts.bulkRateStartsAt - 1;
  if (count <= standardLimit) return count * QUOTATION_PRICING.staticPosts.standardRate;
  if (count < QUOTATION_PRICING.staticPosts.fullOrderBulkRateStartsAt) {
    return standardLimit * QUOTATION_PRICING.staticPosts.standardRate + (count - standardLimit) * QUOTATION_PRICING.staticPosts.bulkRate;
  }
  return count * QUOTATION_PRICING.staticPosts.bulkRate;
}

export function calculateQuotationTotal(selection) {
  const managementTotal = selection.management && selection.platforms.length
    ? QUOTATION_PRICING.managementFirstPlatform + Math.max(selection.platforms.length - 1, 0) * QUOTATION_PRICING.managementAdditionalPlatform
    : 0;
  return managementTotal + calculateStaticPostsPrice(selection.quantities.posts) +
    selection.quantities.video25 * QUOTATION_PRICING.video25 + selection.quantities.video50 * QUOTATION_PRICING.video50 +
    selection.quantities.stories * QUOTATION_PRICING.story + selection.quantities.aiVideo45 * QUOTATION_PRICING.aiVideo45 +
    selection.quantities.aiVideo90 * QUOTATION_PRICING.aiVideo90;
}

export function normalizeQuotationSelection(input) {
  if (!input || !input.quantities || !Array.isArray(input.platforms) || !input.youtube || typeof input.management !== 'boolean') return null;
  const quantities = {};
  if (!QUANTITY_KEYS.every(function (key) {
    const value = input.quantities[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > QUOTATION_PRICING.maximumQuantity) return false;
    quantities[key] = value;
    return true;
  })) return null;
  if (input.platforms.length > ALLOWED_PLATFORMS.length || !input.platforms.every(function (platform, index) {
    return ALLOWED_PLATFORMS.includes(platform) && input.platforms.indexOf(platform) === index;
  })) return null;
  const youtube = input.youtube;
  if (typeof youtube.enabled !== 'boolean' || !Array.isArray(youtube.videos) || youtube.videos.length < 1 || youtube.videos.length > 20) return null;
  const durations = youtube.videos.map(function (video) { return video && video.durationMinutes; });
  if (!durations.every(function (duration) { return Number.isInteger(duration) && duration >= 1 && duration <= 180; })) return null;
  if (youtube.enabled && !Object.prototype.hasOwnProperty.call(EDITING_LABELS, youtube.editingType)) return null;
  if (!Array.isArray(youtube.addOns) || !youtube.addOns.every(function (addon, index) {
    return Object.prototype.hasOwnProperty.call(ADDON_LABELS, addon) && youtube.addOns.indexOf(addon) === index;
  })) return null;
  const hasPrimaryContent = quantities.posts + quantities.video25 + quantities.video50 + quantities.aiVideo45 + quantities.aiVideo90 > 0 || youtube.enabled;
  if (!hasPrimaryContent || (input.management && input.platforms.length === 0) || (!input.management && input.platforms.length > 0)) return null;
  return {
    quantities: quantities,
    platforms: input.platforms.slice(),
    management: input.management,
    youtube: {
      enabled: youtube.enabled,
      videos: durations.map(function (duration) { return { durationMinutes: duration }; }),
      videoCount: durations.length,
      totalDuration: durations.reduce(function (total, duration) { return total + duration; }, 0),
      editingType: youtube.editingType || '',
      editingTypeLabel: youtube.enabled ? EDITING_LABELS[youtube.editingType] : '',
      addOns: youtube.addOns.slice()
    }
  };
}

export function buildQuotationServices(selection) {
  const services = [];
  function add(id, service, details) { services.push({ id: id, service: service, details: details }); }
  const q = selection.quantities;
  if (q.posts > 0) add('posts', 'Static Posts', q.posts + (q.posts === 1 ? ' post' : ' posts'));
  if (q.video25 > 0) add('video25', 'Professional Videos', q.video25 + (q.video25 === 1 ? ' video' : ' videos') + ' \u00b7 Up to 25 seconds each');
  if (q.video50 > 0) add('video50', 'Professional Videos', q.video50 + (q.video50 === 1 ? ' video' : ' videos') + ' \u00b7 Up to 50 seconds each');
  if (q.stories > 0) add('stories', 'Simple Story Videos', q.stories + (q.stories === 1 ? ' story video' : ' story videos') + ' \u00b7 Up to 20 seconds each');
  if (q.aiVideo45 > 0) add('aiVideo45', 'AI Videos', q.aiVideo45 + (q.aiVideo45 === 1 ? ' video' : ' videos') + ' \u00b7 Up to 45 seconds each');
  if (q.aiVideo90 > 0) add('aiVideo90', 'AI Videos', q.aiVideo90 + (q.aiVideo90 === 1 ? ' video' : ' videos') + ' \u00b7 Up to 1.5 minutes each');
  if (selection.management && selection.platforms.length) add('management', 'Social Media Management', 'Platforms: ' + selection.platforms.join(', '));
  if (selection.youtube.enabled) {
    let details = selection.youtube.videoCount + (selection.youtube.videoCount === 1 ? ' video' : ' videos') +
      ' \u00b7 Durations: ' + selection.youtube.videos.map(function (video) { return video.durationMinutes + ' min'; }).join(', ') +
      ' \u00b7 ' + selection.youtube.editingTypeLabel;
    if (selection.youtube.addOns.length) details += ' \u00b7 Add-ons: ' + selection.youtube.addOns.map(function (addon) { return ADDON_LABELS[addon]; }).join(', ');
    add('youtube', 'YouTube Long-Form Editing', details);
  }
  return services;
}

export function createQuotationSnapshot(input) {
  const selection = normalizeQuotationSelection(input.selection);
  if (!selection || !isSafeString(input.reference, 80) || !isIsoDate(input.issueDate)) return null;
  const original = calculateQuotationTotal(selection);
  const discount = input.discountAmount || 0;
  if (!Number.isSafeInteger(discount) || discount < 0 || (discount > 0 && discount >= original)) return null;
  return {
    version: QUOTATION_VERSION,
    reference: input.reference,
    issueDate: input.issueDate,
    expiryDate: addQuotationDays(input.issueDate, 28),
    createdAt: input.createdAt || new Date().toISOString(),
    selection: selection,
    services: buildQuotationServices(selection),
    totals: { original: original, discount: discount, final: original - discount },
    quoteOnly: selection.youtube.enabled && original === 0,
    monthly: Boolean(selection.management && selection.platforms.length),
    hasQuoteOnlyService: selection.youtube.enabled,
    notes: { advertisingBudgetExcluded: true, adBoostingSupportIncluded: Boolean(selection.management && selection.platforms.length), validityDays: 28 }
  };
}

function migrateLegacySnapshot(snapshot) {
  if (!snapshot || snapshot.version !== 1) return null;
  const migrated = createQuotationSnapshot({
    reference: snapshot.reference,
    issueDate: snapshot.issueDate,
    createdAt: snapshot.createdAt,
    selection: snapshot.selection,
    discountAmount: snapshot.coupon && snapshot.coupon.amount || 0
  });
  if (!migrated || snapshot.expiryDate !== migrated.expiryDate || snapshot.originalTotal !== migrated.totals.original || snapshot.total !== migrated.totals.final) return null;
  return migrated;
}

export function normalizeAndValidateQuotationSnapshot(input) {
  const snapshot = input && input.version === 1 ? migrateLegacySnapshot(input) : input;
  if (!snapshot || snapshot.version !== QUOTATION_VERSION || !isSafeString(snapshot.reference, 80) || !isIsoDate(snapshot.issueDate)) return null;
  const expected = createQuotationSnapshot({ reference: snapshot.reference, issueDate: snapshot.issueDate, createdAt: snapshot.createdAt, selection: snapshot.selection, discountAmount: snapshot.totals && snapshot.totals.discount });
  if (!expected || snapshot.expiryDate !== expected.expiryDate) return null;
  if (JSON.stringify(snapshot.services) !== JSON.stringify(expected.services) || JSON.stringify(snapshot.totals) !== JSON.stringify(expected.totals)) return null;
  if (snapshot.quoteOnly !== expected.quoteOnly || snapshot.monthly !== expected.monthly || snapshot.hasQuoteOnlyService !== expected.hasQuoteOnlyService) return null;
  return expected;
}

export function quotationStorageKey(reference) {
  return QUOTATION_STORAGE_PREFIX + reference;
}

export function createWindowNameEnvelope(snapshot) {
  return JSON.stringify({ type: 'zyntra-quotation', version: QUOTATION_VERSION, reference: snapshot.reference, snapshot: snapshot });
}

export function readWindowNameEnvelope(value, reference) {
  try {
    const envelope = JSON.parse(value || '');
    if (!envelope || envelope.type !== 'zyntra-quotation' || envelope.reference !== reference) return null;
    return normalizeAndValidateQuotationSnapshot(envelope.snapshot);
  } catch (_error) {
    return null;
  }
}
