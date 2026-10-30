import {
  LEGACY_QUOTATION_STORAGE_KEY,
  normalizeAndValidateQuotationSnapshot,
  quotationStorageKey,
  readWindowNameEnvelope
} from '../../js/quotation-schema.js';

(function () {
  'use strict';

  var STORAGE_KEY = LEGACY_QUOTATION_STORAGE_KEY;
  var documentElement = document.getElementById('quotation-document');
  var messageElement = document.getElementById('quotation-message');
  var messageText = document.getElementById('quotation-message-text');
  var printButton = document.getElementById('quotation-print');
  var printReady = false;

  function readStorageJson(storage, key) {
    try {
      var raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function readSnapshot() {
    var reference = new URLSearchParams(window.location.search).get('quote');
    if (reference) {
      var key = quotationStorageKey(reference);
      return {
        explicitlyRequested: true,
        snapshot: normalizeAndValidateQuotationSnapshot(readStorageJson(window.sessionStorage, key)) ||
          normalizeAndValidateQuotationSnapshot(readStorageJson(window.localStorage, key)) ||
          readWindowNameEnvelope(window.name, reference)
      };
    }
    return { explicitlyRequested: false, snapshot: normalizeAndValidateQuotationSnapshot(readStorageJson(window.sessionStorage, STORAGE_KEY)) };
  }

  function getColomboToday() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
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

  function createQuotationDisplayTotals(snapshot) {
    return {
      packageTotal: snapshot.totals.original,
      couponDiscount: snapshot.totals.discount,
      finalPackageTotal: snapshot.totals.final
    };
  }

  function renderSnapshot(snapshot) {
    var displayTotals = createQuotationDisplayTotals(snapshot);
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

    var hasDiscount = snapshot.totals.discount > 0;
    document.getElementById('quotation-total-label').textContent = snapshot.quoteOnly ? 'PACKAGE TOTAL' : (hasDiscount ? 'FINAL PACKAGE TOTAL' : (snapshot.monthly ? 'MONTHLY PACKAGE TOTAL' : 'PACKAGE TOTAL'));
    document.getElementById('quotation-total').textContent = snapshot.quoteOnly ? 'Custom quote required' : formatRupees(displayTotals.finalPackageTotal);
    if (hasDiscount) {
      document.getElementById('quotation-original-total').textContent = formatRupees(displayTotals.packageTotal);
      document.getElementById('quotation-coupon-label').textContent = 'COUPON DISCOUNT';
      document.getElementById('quotation-coupon-discount').textContent = '\u2212' + formatRupees(displayTotals.couponDiscount);
      document.getElementById('quotation-original-row').hidden = false;
      document.getElementById('quotation-coupon-row').hidden = false;
    }
    document.getElementById('quotation-quote-only-notice').hidden = !snapshot.hasQuoteOnlyService;
    document.getElementById('quotation-advertising-notice').textContent = snapshot.notes.adBoostingSupportIncluded
      ? 'Ad boosting support is included with your selected social media management package. Advertising spend/ad budget is not included and will be discussed separately.'
      : 'Advertising spend and ad boosting management are not included in this content package.';

    if (getColomboToday() > snapshot.expiryDate) document.getElementById('quotation-expired').hidden = false;
    messageElement.hidden = true;
    documentElement.hidden = false;
    waitForPrintAssets().then(function () {
      printReady = true;
      printButton.disabled = false;
    });
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
    if (!printReady || printButton.disabled) return;
    printButton.disabled = true;
    window.print();
    printButton.disabled = false;
  });

  var result = readSnapshot();
  if (!result.snapshot) showError(result.explicitlyRequested
    ? 'This quotation could not be found or is incomplete. Return to the Package Builder and generate it again.'
    : 'No generated quotation was found. Return to the Package Builder and click Create My Package first.');
  else renderSnapshot(result.snapshot);
}());
