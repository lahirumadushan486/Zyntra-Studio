(function () {
  'use strict';

  var STORAGE_KEY = 'zyntra.customPackageQuotation.v1';
  var VERSION = 1;
  var ALLOWED_SERVICE_IDS = ['posts', 'video25', 'video50', 'stories', 'aiVideo45', 'aiVideo90', 'management', 'youtube'];
  var ALLOWED_PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'YouTube'];
  var ALLOWED_EDITING_TYPES = ['basic', 'professional', 'advanced'];
  var ALLOWED_ADDONS = ['thumbnail', 'subtitles', 'introOutro', 'motionGraphics'];
  var documentElement = document.getElementById('quotation-document');
  var messageElement = document.getElementById('quotation-message');
  var messageText = document.getElementById('quotation-message-text');
  var printButton = document.getElementById('quotation-print');

  function readSnapshot() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    var parts = value.split('-').map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
  }

  function addCalendarDays(isoDate, days) {
    var parts = isoDate.split('-').map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function getColomboToday() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
  }

  function isSafeString(value, maximum) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum;
  }

  function validSelection(selection) {
    if (!selection || !selection.quantities || !selection.youtube || !Array.isArray(selection.platforms)) return false;
    var quantityKeys = ['posts', 'video25', 'video50', 'stories', 'aiVideo45', 'aiVideo90'];
    var quantitiesValid = quantityKeys.every(function (key) {
      return Number.isSafeInteger(selection.quantities[key]) && selection.quantities[key] >= 0 && selection.quantities[key] <= 999;
    });
    var platformsValid = selection.platforms.length <= ALLOWED_PLATFORMS.length && selection.platforms.every(function (platform, index) {
      return ALLOWED_PLATFORMS.includes(platform) && selection.platforms.indexOf(platform) === index;
    });
    var youtube = selection.youtube;
    var youtubeValid = typeof youtube.enabled === 'boolean' && Array.isArray(youtube.videos) && youtube.videos.length >= 1 && youtube.videos.length <= 20 &&
      youtube.videos.every(function (video) { return video && Number.isInteger(video.durationMinutes) && video.durationMinutes >= 1 && video.durationMinutes <= 180; }) &&
      (!youtube.enabled || ALLOWED_EDITING_TYPES.includes(youtube.editingType)) && Array.isArray(youtube.addOns) &&
      youtube.addOns.every(function (addon) { return ALLOWED_ADDONS.includes(addon); });
    return quantitiesValid && platformsValid && youtubeValid && typeof selection.management === 'boolean';
  }

  function calculateExpectedTotal(selection) {
    var postRate = selection.quantities.posts >= 11 ? 800 : 1000;
    var managementTotal = selection.management && selection.platforms.length ? 7000 + Math.max(0, selection.platforms.length - 1) * 1000 : 0;
    return managementTotal + selection.quantities.posts * postRate + selection.quantities.video25 * 2000 +
      selection.quantities.video50 * 3000 + selection.quantities.stories * 1400 +
      selection.quantities.aiVideo45 * 3500 + selection.quantities.aiVideo90 * 5500;
  }

  function expectedServiceIds(selection) {
    var ids = [];
    if (selection.quantities.posts) ids.push('posts');
    if (selection.quantities.video25) ids.push('video25');
    if (selection.quantities.video50) ids.push('video50');
    if (selection.quantities.stories) ids.push('stories');
    if (selection.quantities.aiVideo45) ids.push('aiVideo45');
    if (selection.quantities.aiVideo90) ids.push('aiVideo90');
    if (selection.management && selection.platforms.length) ids.push('management');
    if (selection.youtube.enabled) ids.push('youtube');
    return ids;
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== VERSION || !isSafeString(snapshot.reference, 80)) return false;
    if (!isIsoDate(snapshot.issueDate) || !isIsoDate(snapshot.expiryDate) || snapshot.expiryDate !== addCalendarDays(snapshot.issueDate, 28)) return false;
    if (!validSelection(snapshot.selection) || !Array.isArray(snapshot.services) || snapshot.services.length < 1 || snapshot.services.length > 8) return false;
    if (!Number.isSafeInteger(snapshot.total) || snapshot.total < 0 || snapshot.total > 1000000000) return false;
    if (typeof snapshot.quoteOnly !== 'boolean' || typeof snapshot.monthly !== 'boolean' || typeof snapshot.hasQuoteOnlyService !== 'boolean') return false;
    if (snapshot.total !== calculateExpectedTotal(snapshot.selection)) return false;
    if (snapshot.quoteOnly !== (snapshot.selection.youtube.enabled && snapshot.total === 0)) return false;
    if (snapshot.monthly !== Boolean(snapshot.selection.management && snapshot.selection.platforms.length)) return false;
    if (snapshot.hasQuoteOnlyService !== snapshot.selection.youtube.enabled) return false;
    var ids = [];
    var servicesValid = snapshot.services.every(function (service) {
      if (!service || !ALLOWED_SERVICE_IDS.includes(service.id) || ids.includes(service.id)) return false;
      ids.push(service.id);
      return isSafeString(service.service, 80) && isSafeString(service.details, 1200);
    });
    return servicesValid && ids.join('|') === expectedServiceIds(snapshot.selection).join('|');
  }

  function formatDate(isoDate) {
    var parts = isoDate.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
  }

  function formatRupees(amount) {
    return 'Rs. ' + amount.toLocaleString('en-US');
  }

  function showError(message) {
    messageText.textContent = message;
    messageElement.hidden = false;
    documentElement.hidden = true;
    printButton.disabled = true;
  }

  function buildIncludedServices(selection) {
    var items = [];
    function add(value) { if (!items.includes(value)) items.push(value); }
    if (selection.quantities.video25 > 0) {
      add('Text animation'); add('Colour grading'); add('Professional editing'); add('Social-media-ready final video');
    }
    if (selection.quantities.video50 > 0) {
      add('Longer-form professional editing'); add('Colour grading'); add('Social-media-ready delivery');
    }
    if (selection.quantities.stories > 0) add('Simple story-style editing');
    if (selection.quantities.aiVideo45 > 0 || selection.quantities.aiVideo90 > 0) add('AI-generated video production for the selected durations');
    if (selection.youtube.enabled) {
      var editingLabels = { basic: 'Basic Editing', professional: 'Professional Editing', advanced: 'Advanced Editing' };
      var addonLabels = { thumbnail: 'Thumbnail Design', subtitles: 'Subtitles', introOutro: 'Intro / Outro', motionGraphics: 'Motion Graphics' };
      add('YouTube long-form: ' + editingLabels[selection.youtube.editingType]);
      selection.youtube.addOns.forEach(function (addon) { add(addonLabels[addon]); });
    }
    if (selection.management && selection.platforms.length) {
      add('Content scheduling'); add('Page maintenance'); add('Ad boosting support');
    }
    return items;
  }

  function renderSnapshot(snapshot) {
    document.getElementById('quotation-reference').textContent = snapshot.reference;
    document.getElementById('quotation-issued').textContent = formatDate(snapshot.issueDate);
    document.getElementById('quotation-expiry').textContent = formatDate(snapshot.expiryDate);
    document.getElementById('quotation-validity-date').textContent = 'Valid until: ' + formatDate(snapshot.expiryDate);
    document.title = 'Zyntra-Studio-Quotation-' + snapshot.reference;

    var servicesBody = document.getElementById('quotation-services');
    snapshot.services.forEach(function (service) {
      var row = document.createElement('tr');
      var name = document.createElement('td');
      var details = document.createElement('td');
      name.textContent = service.service;
      details.textContent = service.details;
      row.append(name, details);
      servicesBody.appendChild(row);
    });

    var includedItems = buildIncludedServices(snapshot.selection);
    if (includedItems.length) {
      var includedList = document.getElementById('quotation-included');
      includedItems.forEach(function (item) {
        var listItem = document.createElement('li');
        listItem.textContent = item;
        includedList.appendChild(listItem);
      });
      document.getElementById('quotation-included-section').hidden = false;
    }

    document.getElementById('quotation-total-label').textContent = snapshot.quoteOnly ? 'PACKAGE TOTAL' : (snapshot.monthly ? 'MONTHLY PACKAGE TOTAL' : 'PACKAGE TOTAL');
    document.getElementById('quotation-total').textContent = snapshot.quoteOnly ? 'Custom quote required' : formatRupees(snapshot.total);
    document.getElementById('quotation-quote-only-notice').hidden = !snapshot.hasQuoteOnlyService;
    document.getElementById('quotation-advertising-notice').textContent = snapshot.selection.management && snapshot.selection.platforms.length
      ? 'Ad boosting support is included with your selected social media management package. Advertising spend/ad budget is not included and will be discussed separately.'
      : 'Advertising spend and ad boosting management are not included in this content package.';

    if (getColomboToday() > snapshot.expiryDate) document.getElementById('quotation-expired').hidden = false;
    messageElement.hidden = true;
    documentElement.hidden = false;
    printButton.disabled = false;
  }

  function waitForPrintAssets() {
    var logo = document.getElementById('quotation-logo');
    var logoReady = logo.complete ? Promise.resolve() : new Promise(function (resolve) {
      logo.addEventListener('load', resolve, { once: true });
      logo.addEventListener('error', resolve, { once: true });
    });
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return Promise.all([fontsReady, logoReady]);
  }

  printButton.addEventListener('click', function () {
    if (printButton.disabled) return;
    printButton.disabled = true;
    waitForPrintAssets().then(function () { window.print(); }).finally(function () { printButton.disabled = false; });
  });

  var snapshot = readSnapshot();
  if (!snapshot) showError('No generated quotation was found. Return to the Package Builder and click Create My Package first.');
  else if (!validateSnapshot(snapshot)) showError('The saved quotation is incomplete or invalid. Return to the Package Builder and generate it again.');
  else renderSnapshot(snapshot);
}());
