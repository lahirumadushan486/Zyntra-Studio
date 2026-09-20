(function () {
  'use strict';

  var root = document.getElementById('custom-package-builder');
  if (!root) return;

  var PRICING = Object.freeze({
    managementFirstPlatform: 5000,
    managementAdditionalPlatform: 500,
    postFirstTen: 1000,
    postAfterTen: 800,
    video25: 2000,
    video50: 2500,
    story: 1400,
    maximumQuantity: 999
  });
  var EXPORT_SCALE = 2;

  var form = root.querySelector('#custom-package-form');
  var managementToggle = root.querySelector('#custom-management-enabled');
  var platformsPanel = root.querySelector('#custom-platforms');
  var platformInputs = Array.prototype.slice.call(root.querySelectorAll('input[name="custom-platform"]'));
  var quantityInputs = {
    posts: root.querySelector('#custom-post-count'),
    video25: root.querySelector('#custom-video-25-count'),
    video50: root.querySelector('#custom-video-50-count'),
    stories: root.querySelector('#custom-story-count')
  };
  var totalLabel = root.querySelector('#custom-package-total-label');
  var totalOutput = root.querySelector('#custom-package-total');
  var notice = root.querySelector('#custom-package-notice');
  var validation = root.querySelector('#custom-package-validation');
  var createButton = root.querySelector('#custom-package-create');
  var result = root.querySelector('#custom-package-result');
  var card = root.querySelector('#custom-package-card');
  var cardPlatforms = root.querySelector('#custom-card-platforms');
  var cardItems = root.querySelector('#custom-card-items');
  var cardManagement = root.querySelector('#custom-card-management');
  var cardTotalLabel = root.querySelector('#custom-card-total-label');
  var cardTotal = root.querySelector('#custom-card-total');
  var cardNotice = root.querySelector('#custom-card-notice');
  var downloadButton = root.querySelector('#custom-package-download');
  var downloadStatus = root.querySelector('#custom-package-download-status');
  var hasGeneratedCard = false;
  var isExporting = false;
  var cardRevision = 0;
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var downloadButtonLabel = downloadButton.textContent;

  function formatRupees(amount) {
    return 'Rs. ' + amount.toLocaleString('en-US');
  }

  function readQuantity(input) {
    var raw = input.value.trim();
    var valid = /^\d+$/.test(raw);
    var value = valid ? Number(raw) : 0;
    valid = valid && Number.isSafeInteger(value) && value >= 0 && value <= PRICING.maximumQuantity;
    input.setAttribute('aria-invalid', String(!valid));
    return { valid: valid, value: valid ? value : 0 };
  }

  function getState() {
    var quantities = {};
    var quantitiesValid = true;
    Object.keys(quantityInputs).forEach(function (key) {
      var result = readQuantity(quantityInputs[key]);
      quantities[key] = result.value;
      quantitiesValid = quantitiesValid && result.valid;
    });
    var selectedPlatforms = platformInputs.filter(function (input) { return input.checked; }).map(function (input) { return input.value; });
    var management = managementToggle.checked;
    var mainContentCount = quantities.posts + quantities.video25 + quantities.video50;
    var managementTotal = management && selectedPlatforms.length ? PRICING.managementFirstPlatform + Math.max(selectedPlatforms.length - 1, 0) * PRICING.managementAdditionalPlatform : 0;
    var postTotal = Math.min(quantities.posts, 10) * PRICING.postFirstTen + Math.max(quantities.posts - 10, 0) * PRICING.postAfterTen;
    var total = managementTotal + postTotal + quantities.video25 * PRICING.video25 + quantities.video50 * PRICING.video50 + quantities.stories * PRICING.story;
    var valid = quantitiesValid && mainContentCount > 0 && (!management || selectedPlatforms.length > 0);
    var message = 'Your package is ready to create.';
    if (!quantitiesValid) message = 'Enter whole-number quantities from 0 to ' + PRICING.maximumQuantity + '.';
    else if (mainContentCount === 0 && quantities.stories > 0) message = 'Story videos are an add-on. Add at least one static post or professional video.';
    else if (mainContentCount === 0 && management) message = 'Management requires at least one static post or professional video.';
    else if (mainContentCount === 0) message = 'Choose at least one static post or professional video to create a package.';
    else if (management && selectedPlatforms.length === 0) message = 'Select at least one platform for social media management.';
    return { quantities: quantities, quantitiesValid: quantitiesValid, platforms: selectedPlatforms, management: management, total: total, valid: valid, message: message };
  }

  function updateCard(state) {
    cardTotalLabel.textContent = state.management ? 'MONTHLY PACKAGE TOTAL' : 'PACKAGE TOTAL';
    cardTotal.textContent = formatRupees(state.total);
    cardNotice.textContent = state.management
      ? 'Ad boosting support is included. Advertising spend/ad budget is not included and will be discussed separately because platform rates can change.'
      : 'Advertising spend is not included in this content package.';
    cardPlatforms.replaceChildren();
    state.platforms.forEach(function (platform) {
      var chip = document.createElement('span');
      chip.textContent = platform;
      cardPlatforms.appendChild(chip);
    });
    cardPlatforms.hidden = !state.management;
    cardItems.replaceChildren();
    var selectedItems = [];
    if (state.quantities.posts > 0) selectedItems.push(['Static Posts', state.quantities.posts + (state.quantities.posts === 1 ? ' post' : ' posts')]);
    if (state.quantities.video25 > 0) selectedItems.push(['Professional Videos · up to 25 seconds', state.quantities.video25 + (state.quantities.video25 === 1 ? ' video · Text animation, colour grading and professional editing' : ' videos · Text animation, colour grading and professional editing')]);
    if (state.quantities.video50 > 0) selectedItems.push(['Professional Videos · up to 50 seconds', state.quantities.video50 + (state.quantities.video50 === 1 ? ' video · Longer-form professional editing and colour grading' : ' videos · Longer-form professional editing and colour grading')]);
    if (state.quantities.stories > 0) selectedItems.push(['Simple Story Videos · up to 30 seconds', state.quantities.stories + (state.quantities.stories === 1 ? ' story video · Simple story-style editing' : ' story videos · Simple story-style editing')]);
    selectedItems.forEach(function (item) {
      var li = document.createElement('li');
      var strong = document.createElement('strong');
      var span = document.createElement('span');
      strong.textContent = item[0];
      span.textContent = item[1];
      li.append(strong, span);
      cardItems.appendChild(li);
    });
    cardManagement.hidden = !state.management;
    cardRevision += 1;
  }

  function update() {
    var state = getState();
    totalLabel.textContent = state.management ? 'MONTHLY PACKAGE TOTAL' : 'PACKAGE TOTAL';
    totalOutput.textContent = state.quantitiesValid ? formatRupees(state.total) : 'Rs. —';
    notice.textContent = state.management
      ? 'Ad boosting support is included. Advertising spend/ad budget is not included and will be discussed separately because platform rates can change.'
      : 'Advertising spend is not included in this content package.';
    validation.textContent = state.message;
    validation.classList.toggle('is-valid', state.valid);
    validation.classList.toggle('is-error', !state.valid && (state.quantities.stories > 0 || state.management || !state.quantitiesValid));
    createButton.disabled = !state.valid;
    if (hasGeneratedCard) {
      if (state.valid) {
        updateCard(state);
        result.hidden = false;
        downloadButton.disabled = isExporting;
        downloadStatus.textContent = 'Package card updated to match your latest selection.';
      } else {
        result.hidden = true;
        downloadButton.disabled = true;
      }
    }
    return state;
  }

  managementToggle.addEventListener('change', function () {
    platformsPanel.hidden = !managementToggle.checked;
    if (!managementToggle.checked) platformInputs.forEach(function (input) { input.checked = false; });
    update();
  });
  form.addEventListener('input', update);
  form.addEventListener('change', update);

  root.querySelectorAll('[data-quantity-control]').forEach(function (control) {
    control.addEventListener('click', function (event) {
      var button = event.target.closest('[data-quantity-action]');
      if (!button) return;
      var input = control.querySelector('input');
      var current = readQuantity(input);
      var value = current.valid ? current.value : 0;
      value += button.getAttribute('data-quantity-action') === 'increase' ? 1 : -1;
      input.value = String(Math.min(PRICING.maximumQuantity, Math.max(0, value)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var state = update();
    if (!state.valid) return;
    hasGeneratedCard = true;
    updateCard(state);
    result.hidden = false;
    downloadButton.disabled = isExporting;
    downloadStatus.textContent = '';
    result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  });

  function waitForCardAssets(scope) {
    var images = Array.prototype.slice.call(scope.querySelectorAll('img'));
    var imagesReady = Promise.all(images.map(function (image) {
      if (image.hidden || !image.src) return Promise.resolve();
      if (image.complete) {
        if (image.naturalWidth === 0) return Promise.resolve();
        return typeof image.decode === 'function' ? image.decode().catch(function () {}) : Promise.resolve();
      }
      return new Promise(function (resolve) {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
    return Promise.all([fontsReady, imagesReady]);
  }

  function removeLegacyExportHosts() {
    root.querySelectorAll('.custom-package-export-host').forEach(function (element) { element.remove(); });
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('The image could not be created. Please try again.'));
      }, 'image/png');
    });
  }

  function removeFromAccessibilityFlow(element) {
    element.setAttribute('aria-hidden', 'true');
    element.tabIndex = -1;
  }

  downloadButton.addEventListener('click', async function () {
    if (isExporting) return;
    var state = update();
    if (!state.valid || !hasGeneratedCard) return;
    updateCard(state);
    isExporting = true;
    downloadButton.disabled = true;
    downloadButton.textContent = 'Preparing image…';
    downloadStatus.textContent = 'Preparing your high-quality package image…';
    removeLegacyExportHosts();

    var canvas;
    var downloadLink;
    var objectUrl;
    var existingCloneContainers = new Set(document.querySelectorAll('.html2canvas-container'));
    var cloneObserver = typeof MutationObserver === 'function' ? new MutationObserver(function (records) {
      records.forEach(function (record) {
        Array.prototype.forEach.call(record.addedNodes, function (node) {
          if (node.nodeType === 1 && node.classList.contains('html2canvas-container')) removeFromAccessibilityFlow(node);
        });
      });
    }) : null;
    if (cloneObserver) cloneObserver.observe(document.body, { childList: true });

    try {
      if (typeof window.html2canvas !== 'function') throw new Error('The image export library did not load. Please refresh and try again.');

      await waitForCardAssets(card);
      var renderedRevision;
      do {
        renderedRevision = cardRevision;
        var bounds = card.getBoundingClientRect();
        canvas = await window.html2canvas(card, {
          backgroundColor: null,
          scale: EXPORT_SCALE,
          useCORS: true,
          logging: false,
          imageTimeout: 15000,
          removeContainer: true,
          onclone: function (clonedDocument) {
            clonedDocument.body.setAttribute('aria-hidden', 'true');
          },
          width: Math.ceil(bounds.width),
          height: Math.ceil(bounds.height),
          windowWidth: document.documentElement.clientWidth,
          windowHeight: document.documentElement.clientHeight
        });
        if (renderedRevision !== cardRevision) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
        }
      } while (renderedRevision !== cardRevision);

      var blob = await canvasToBlob(canvas);
      objectUrl = URL.createObjectURL(blob);
      downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = 'Zyntra-Studio-Custom-Package.png';
      downloadLink.hidden = true;
      downloadLink.tabIndex = -1;
      downloadLink.setAttribute('aria-hidden', 'true');
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadStatus.textContent = 'Package image downloaded.';
    } catch (error) {
      downloadStatus.textContent = error && error.message
        ? error.message
        : 'The package image could not be downloaded. Please try again.';
    } finally {
      if (cloneObserver) cloneObserver.disconnect();
      if (downloadLink) downloadLink.remove();
      if (objectUrl) window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 30000);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      document.querySelectorAll('.html2canvas-container').forEach(function (element) {
        if (!existingCloneContainers.has(element)) element.remove();
      });
      removeLegacyExportHosts();
      isExporting = false;
      downloadButton.textContent = downloadButtonLabel;
      var latestState = getState();
      downloadButton.disabled = !hasGeneratedCard || !latestState.valid;
    }
  });

  update();
}());
