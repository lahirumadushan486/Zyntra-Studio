(function () {
  'use strict';

  var root = document.getElementById('custom-package-builder');
  if (!root) return;

  var PRICING = Object.freeze({
    managementFirstPlatform: 7000,
    managementAdditionalPlatform: 1000,
    postFirstTen: 1000,
    postAfterTen: 800,
    video25: 2000,
    video50: 3000,
    story: 1400,
    maximumQuantity: 999
  });
  var EXPORT_SCALE = 2;
  var EXPORT_WIDTH = 1080;

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
  var youtubeToggle = root.querySelector('#custom-youtube-enabled');
  var youtubeDetails = root.querySelector('#custom-youtube-details');
  var youtubeCountOutput = root.querySelector('#custom-youtube-count');
  var youtubeDecreaseButton = root.querySelector('#custom-youtube-decrease');
  var youtubeIncreaseButton = root.querySelector('#custom-youtube-increase');
  var youtubeDurations = root.querySelector('#custom-youtube-durations');
  var youtubeTotalDuration = root.querySelector('#custom-youtube-total-duration');
  var youtubeEditingInputs = Array.prototype.slice.call(root.querySelectorAll('input[name="custom-youtube-editing-type"]'));
  var youtubeAddonInputs = Array.prototype.slice.call(root.querySelectorAll('input[name="custom-youtube-addon"]'));
  var YOUTUBE_EDITING_TYPES = Object.freeze({ basic: 'Basic Editing', professional: 'Professional Editing', advanced: 'Advanced Editing' });
  var YOUTUBE_ADDONS = Object.freeze({ thumbnail: 'Thumbnail Design', subtitles: 'Subtitles', introOutro: 'Intro / Outro', motionGraphics: 'Motion Graphics' });
  var youtubeLongForm = {
    enabled: false,
    videos: [{ durationMinutes: 1, inputValue: '1' }],
    editingType: '',
    addOns: { thumbnail: false, subtitles: false, introOutro: false, motionGraphics: false }
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
  var shareButton = root.querySelector('#custom-package-share');
  var copyLinkButton = root.querySelector('#custom-package-copy-link');
  var shareStatus = root.querySelector('#custom-package-share-status');
  var hasGeneratedCard = false;
  var isExporting = false;
  var isSharing = false;
  var cardRevision = 0;
  var shareStatusTimer;
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

  function getYoutubeState() {
    var videos = youtubeLongForm.videos.map(function (video) {
      return { durationMinutes: video.durationMinutes };
    });
    var durationsValid = videos.length >= 1 && videos.length <= 20 && videos.every(function (video) {
      return Number.isInteger(video.durationMinutes) && video.durationMinutes >= 1 && video.durationMinutes <= 180;
    });
    var editingTypeValid = Object.prototype.hasOwnProperty.call(YOUTUBE_EDITING_TYPES, youtubeLongForm.editingType);
    var valid = youtubeLongForm.enabled && durationsValid && editingTypeValid;
    return {
      enabled: youtubeLongForm.enabled,
      videos: videos,
      videoCount: videos.length,
      totalDuration: durationsValid ? videos.reduce(function (total, video) { return total + video.durationMinutes; }, 0) : 0,
      durationsValid: durationsValid,
      editingType: youtubeLongForm.editingType,
      editingTypeLabel: editingTypeValid ? YOUTUBE_EDITING_TYPES[youtubeLongForm.editingType] : '',
      editingTypeValid: editingTypeValid,
      addOns: Object.keys(YOUTUBE_ADDONS).filter(function (key) { return youtubeLongForm.addOns[key]; }),
      valid: valid
    };
  }

  function getPackageNotice(state) {
    var messages = [];
    if (state.youtube.enabled) {
      messages.push(state.quoteOnly
        ? 'Submit or share these requirements with Zyntra Studio to receive the final quotation.'
        : 'The displayed total does not include YouTube long-form video editing. Its final price will be confirmed separately.');
    }
    if (state.management) messages.push('Ad boosting support is included. Advertising spend/ad budget is not included and will be discussed separately because platform rates can change.');
    else if (!state.youtube.enabled) messages.push('Advertising spend is not included in this content package.');
    return messages.join(' ');
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
    var youtube = getYoutubeState();
    var hasPrimaryContent = mainContentCount > 0 || youtube.valid;
    var valid = quantitiesValid && hasPrimaryContent && (!management || selectedPlatforms.length > 0) && (!youtube.enabled || youtube.valid);
    var message = 'Your package is ready to create.';
    if (!quantitiesValid) message = 'Enter whole-number quantities from 0 to ' + PRICING.maximumQuantity + '.';
    else if (youtube.enabled && !youtube.durationsValid) message = 'Enter a whole-number duration from 1 to 180 minutes for every YouTube video.';
    else if (youtube.enabled && !youtube.editingTypeValid) message = 'Select an editing type for YouTube long-form video editing.';
    else if (!hasPrimaryContent && quantities.stories > 0) message = 'Story videos are an add-on. Add a static post, professional video or valid YouTube long-form request.';
    else if (!hasPrimaryContent && management) message = 'Management requires a static post, professional video or valid YouTube long-form request.';
    else if (!hasPrimaryContent) message = 'Choose a static post, professional video or YouTube long-form editing request to create a package.';
    else if (management && selectedPlatforms.length === 0) message = 'Select at least one platform for social media management.';
    return { quantities: quantities, quantitiesValid: quantitiesValid, platforms: selectedPlatforms, management: management, youtube: youtube, total: total, quoteOnly: youtube.enabled && total === 0, valid: valid, message: message };
  }

  function updateCard(state) {
    cardTotalLabel.textContent = state.quoteOnly ? 'YOUTUBE EDITING' : (state.management ? 'MONTHLY PACKAGE TOTAL' : 'PACKAGE TOTAL');
    cardTotal.textContent = state.quoteOnly ? 'CUSTOM QUOTE REQUIRED' : formatRupees(state.total);
    cardNotice.textContent = getPackageNotice(state);
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
    if (state.youtube.enabled) {
      var youtubeItem = document.createElement('li');
      var youtubeTitle = document.createElement('strong');
      var youtubeDetailsList = document.createElement('div');
      var youtubeQuoteNotice = document.createElement('p');
      youtubeItem.className = 'custom-package-card__youtube';
      youtubeTitle.textContent = 'YouTube Long-Form Video Editing';
      [
        'YouTube Long-Form Videos: ' + state.youtube.videoCount,
        'Video Durations: ' + state.youtube.videos.map(function (video) { return video.durationMinutes + (video.durationMinutes === 1 ? ' Minute' : ' Minutes'); }).join(', '),
        'Total Duration: ' + state.youtube.totalDuration + (state.youtube.totalDuration === 1 ? ' Minute' : ' Minutes'),
        'Editing Type: ' + state.youtube.editingTypeLabel
      ].concat(state.youtube.addOns.length ? ['Additional Requirements: ' + state.youtube.addOns.map(function (key) { return YOUTUBE_ADDONS[key]; }).join(', ')] : []).forEach(function (line) {
        var detail = document.createElement('span');
        detail.textContent = line;
        youtubeDetailsList.appendChild(detail);
      });
      youtubeQuoteNotice.textContent = 'YouTube long-form video editing price will be discussed and confirmed separately according to the duration and editing requirements.';
      youtubeItem.append(youtubeTitle, youtubeDetailsList, youtubeQuoteNotice);
      cardItems.appendChild(youtubeItem);
    }
    cardManagement.hidden = !state.management;
    cardRevision += 1;
  }

  function update() {
    var state = getState();
    totalLabel.textContent = state.quoteOnly ? 'YOUTUBE EDITING' : (state.management ? 'MONTHLY PACKAGE TOTAL' : 'PACKAGE TOTAL');
    totalOutput.textContent = state.quoteOnly ? 'CUSTOM QUOTE REQUIRED' : (state.quantitiesValid ? formatRupees(state.total) : 'Rs. —');
    notice.textContent = getPackageNotice(state);
    validation.textContent = state.message;
    validation.classList.toggle('is-valid', state.valid);
    validation.classList.toggle('is-error', !state.valid && (state.quantities.stories > 0 || state.management || state.youtube.enabled || !state.quantitiesValid));
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

  function refreshYoutubeDurationTotal() {
    var youtube = getYoutubeState();
    youtubeCountOutput.textContent = String(youtubeLongForm.videos.length);
    youtubeDecreaseButton.disabled = youtubeLongForm.videos.length <= 1;
    youtubeIncreaseButton.disabled = youtubeLongForm.videos.length >= 20;
    youtubeTotalDuration.textContent = youtube.durationsValid
      ? youtube.totalDuration + (youtube.totalDuration === 1 ? ' Minute' : ' Minutes')
      : 'Complete all durations';
  }

  function renderYoutubeDurations() {
    youtubeDurations.replaceChildren();
    youtubeLongForm.videos.forEach(function (video, index) {
      var row = document.createElement('label');
      var title = document.createElement('strong');
      var inputWrap = document.createElement('span');
      var inputLabel = document.createElement('span');
      var input = document.createElement('input');
      row.className = 'custom-package-builder__duration-row';
      title.textContent = 'Video ' + String(index + 1).padStart(2, '0') + ' Duration';
      inputLabel.textContent = 'Minutes:';
      input.type = 'number';
      input.inputMode = 'numeric';
      input.min = '1';
      input.max = '180';
      input.step = '1';
      input.value = video.inputValue;
      input.setAttribute('aria-label', 'Video ' + (index + 1) + ' duration in minutes');
      input.setAttribute('aria-invalid', String(video.durationMinutes === null));
      input.addEventListener('keydown', function (event) {
        if (['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault();
      });
      input.addEventListener('paste', function (event) {
        var pasted = event.clipboardData ? event.clipboardData.getData('text').trim() : '';
        if (!/^\d+$/.test(pasted) || Number(pasted) < 1 || Number(pasted) > 180) event.preventDefault();
      });
      input.addEventListener('input', function () {
        var raw = input.value.trim();
        var parsed = /^\d+$/.test(raw) ? Number(raw) : NaN;
        var valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 180;
        youtubeLongForm.videos[index].inputValue = raw;
        youtubeLongForm.videos[index].durationMinutes = valid ? parsed : null;
        input.setAttribute('aria-invalid', String(!valid));
        refreshYoutubeDurationTotal();
      });
      inputWrap.append(inputLabel, input);
      row.append(title, inputWrap);
      youtubeDurations.appendChild(row);
    });
    refreshYoutubeDurationTotal();
  }

  function setYoutubeVideoCount(count) {
    var nextCount = Math.min(20, Math.max(1, count));
    while (youtubeLongForm.videos.length < nextCount) youtubeLongForm.videos.push({ durationMinutes: 1, inputValue: '1' });
    if (youtubeLongForm.videos.length > nextCount) youtubeLongForm.videos.splice(nextCount);
    renderYoutubeDurations();
    update();
  }

  youtubeToggle.addEventListener('change', function () {
    youtubeLongForm.enabled = youtubeToggle.checked;
    youtubeDetails.hidden = !youtubeLongForm.enabled;
    update();
  });
  youtubeDecreaseButton.addEventListener('click', function () { setYoutubeVideoCount(youtubeLongForm.videos.length - 1); });
  youtubeIncreaseButton.addEventListener('click', function () { setYoutubeVideoCount(youtubeLongForm.videos.length + 1); });
  youtubeEditingInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      if (input.checked) youtubeLongForm.editingType = input.value;
    });
  });
  youtubeAddonInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      if (Object.prototype.hasOwnProperty.call(YOUTUBE_ADDONS, input.value)) youtubeLongForm.addOns[input.value] = input.checked;
    });
  });

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
      if (!image.src) return Promise.resolve();
      if (image.complete) {
        if (image.naturalWidth === 0) return Promise.resolve();
        return typeof image.decode === 'function' ? image.decode().catch(function () {}) : Promise.resolve();
      }
      return new Promise(function (resolve) {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
    var currentFontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : fontsReady;
    return Promise.all([currentFontsReady, imagesReady]);
  }

  function removeLegacyExportHosts() {
    root.querySelectorAll('.custom-package-export-host').forEach(function (element) { element.remove(); });
  }

  function nextAnimationFrame() {
    return new Promise(function (resolve) { window.requestAnimationFrame(resolve); });
  }

  function createExportCard() {
    var exportCard = card.cloneNode(true);
    exportCard.removeAttribute('id');
    exportCard.removeAttribute('aria-labelledby');
    exportCard.classList.add('custom-package-card--export');
    exportCard.setAttribute('aria-hidden', 'true');
    exportCard.style.width = EXPORT_WIDTH + 'px';
    exportCard.querySelectorAll('[id]').forEach(function (element) { element.removeAttribute('id'); });
    root.appendChild(exportCard);
    return exportCard;
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

  function buildPackageBuilderUrl() {
    var url = new URL(window.location.href);
    var state = getState();
    url.username = '';
    url.password = '';
    url.search = '';
    url.searchParams.set('zpkg', '1');
    url.searchParams.set('posts', String(state.quantities.posts));
    url.searchParams.set('video25', String(state.quantities.video25));
    url.searchParams.set('video50', String(state.quantities.video50));
    url.searchParams.set('stories', String(state.quantities.stories));
    if (state.management) {
      url.searchParams.set('management', '1');
      url.searchParams.set('platforms', state.platforms.join(','));
    }
    if (state.youtube.enabled) {
      url.searchParams.set('yt', '1');
      url.searchParams.set('ytDurations', state.youtube.videos.map(function (video) { return video.durationMinutes === null ? '' : video.durationMinutes; }).join(','));
      url.searchParams.set('ytEditing', state.youtube.editingType);
      if (state.youtube.addOns.length) url.searchParams.set('ytAddons', state.youtube.addOns.join(','));
    }
    url.hash = 'build-your-package';
    return url.toString();
  }

  function readSharedInteger(params, name, minimum, maximum, fallback) {
    var raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) return fallback;
    var value = Number(raw);
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
  }

  function restoreSharedPackageState() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('zpkg') !== '1') return false;

    quantityInputs.posts.value = String(readSharedInteger(params, 'posts', 0, PRICING.maximumQuantity, 0));
    quantityInputs.video25.value = String(readSharedInteger(params, 'video25', 0, PRICING.maximumQuantity, 0));
    quantityInputs.video50.value = String(readSharedInteger(params, 'video50', 0, PRICING.maximumQuantity, 0));
    quantityInputs.stories.value = String(readSharedInteger(params, 'stories', 0, PRICING.maximumQuantity, 0));

    var allowedPlatforms = platformInputs.map(function (input) { return input.value; });
    var sharedPlatforms = (params.get('platforms') || '').split(',').filter(function (platform, index, values) {
      return allowedPlatforms.includes(platform) && values.indexOf(platform) === index;
    });
    managementToggle.checked = params.get('management') === '1';
    platformsPanel.hidden = !managementToggle.checked;
    platformInputs.forEach(function (input) { input.checked = managementToggle.checked && sharedPlatforms.includes(input.value); });

    if (params.get('yt') === '1') {
      var durationValues = (params.get('ytDurations') || '').split(',');
      var sharedEditingType = params.get('ytEditing') || '';
      var durationsAreSafe = durationValues.length >= 1 && durationValues.length <= 20 && durationValues.every(function (duration) {
        return /^\d+$/.test(duration) && Number(duration) >= 1 && Number(duration) <= 180;
      });
      if (durationsAreSafe && Object.prototype.hasOwnProperty.call(YOUTUBE_EDITING_TYPES, sharedEditingType)) {
        youtubeLongForm.enabled = true;
        youtubeLongForm.videos = durationValues.map(function (duration) {
          return { durationMinutes: Number(duration), inputValue: String(Number(duration)) };
        });
        youtubeLongForm.editingType = sharedEditingType;
        Object.keys(YOUTUBE_ADDONS).forEach(function (key) { youtubeLongForm.addOns[key] = false; });
        (params.get('ytAddons') || '').split(',').forEach(function (key) {
          if (Object.prototype.hasOwnProperty.call(YOUTUBE_ADDONS, key)) youtubeLongForm.addOns[key] = true;
        });
      }
    }

    youtubeToggle.checked = youtubeLongForm.enabled;
    youtubeDetails.hidden = !youtubeLongForm.enabled;
    youtubeEditingInputs.forEach(function (input) { input.checked = input.value === youtubeLongForm.editingType; });
    youtubeAddonInputs.forEach(function (input) { input.checked = Boolean(youtubeLongForm.addOns[input.value]); });
    return true;
  }

  function fallbackCopyLink(value) {
    var textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
    textarea.remove();
    return copied;
  }

  function copyPackageBuilderUrl(url) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(url).then(function () { return true; }, function () { return fallbackCopyLink(url); });
    }
    return Promise.resolve(fallbackCopyLink(url));
  }

  function announceShareStatus(message, isError) {
    window.clearTimeout(shareStatusTimer);
    shareStatus.textContent = message;
    shareStatus.classList.toggle('is-error', Boolean(isError));
    shareStatusTimer = window.setTimeout(function () {
      shareStatus.textContent = '';
      shareStatus.classList.remove('is-error');
    }, 3500);
  }

  function setTemporaryButtonLabel(button, label, originalLabel) {
    var labelElement = button.querySelector('span');
    if (!labelElement) return;
    window.clearTimeout(button.packageShareTimer);
    labelElement.textContent = label;
    button.packageShareTimer = window.setTimeout(function () {
      labelElement.textContent = originalLabel;
    }, 2000);
  }

  function copyLinkWithFeedback(button, originalLabel) {
    button.disabled = true;
    setTemporaryButtonLabel(button, 'Copying...', originalLabel);
    return copyPackageBuilderUrl(buildPackageBuilderUrl()).then(function (copied) {
      if (!copied) throw new Error('Copy failed');
      setTemporaryButtonLabel(button, 'Copied!', originalLabel);
      announceShareStatus('Package builder link copied!', false);
      return true;
    }).catch(function () {
      setTemporaryButtonLabel(button, 'Try Again', originalLabel);
      announceShareStatus('The link could not be copied. Please try again.', true);
      return false;
    }).finally(function () {
      button.disabled = false;
    });
  }

  if (copyLinkButton) {
    copyLinkButton.addEventListener('click', function () {
      copyLinkWithFeedback(copyLinkButton, 'Copy Link');
    });
  }

  if (shareButton) {
    shareButton.addEventListener('click', function () {
      if (isSharing) return;
      var url = buildPackageBuilderUrl();
      if (typeof navigator.share !== 'function') {
        copyLinkWithFeedback(shareButton, 'Share Link');
        return;
      }

      isSharing = true;
      shareButton.disabled = true;
      setTemporaryButtonLabel(shareButton, 'Sharing...', 'Share Link');
      navigator.share({
        title: 'Build Your Own Package \u2013 Zyntra Studio',
        text: 'Create a custom Zyntra Studio package by selecting the posts, videos and social media management services you need.',
        url: url
      }).then(function () {
        setTemporaryButtonLabel(shareButton, 'Shared!', 'Share Link');
        announceShareStatus('Package builder link shared!', false);
      }).catch(function (error) {
        if (error && error.name === 'AbortError') {
          setTemporaryButtonLabel(shareButton, 'Share Link', 'Share Link');
          return;
        }
        return copyLinkWithFeedback(shareButton, 'Share Link');
      }).finally(function () {
        isSharing = false;
        shareButton.disabled = false;
      });
    });
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
    var exportCard;
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

      var renderedRevision;
      do {
        renderedRevision = cardRevision;
        await waitForCardAssets(card);
        exportCard = createExportCard();
        await waitForCardAssets(exportCard);
        await nextAnimationFrame();
        await nextAnimationFrame();

        var exportWidth = Math.ceil(exportCard.scrollWidth);
        var exportHeight = Math.ceil(exportCard.scrollHeight);
        if (!exportWidth || !exportHeight) throw new Error('The package image could not be measured. Please try again.');

        if (renderedRevision !== cardRevision) {
          exportCard.remove();
          exportCard = null;
          continue;
        }

        canvas = await window.html2canvas(exportCard, {
          backgroundColor: null,
          scale: EXPORT_SCALE,
          useCORS: true,
          allowTaint: false,
          logging: false,
          imageTimeout: 15000,
          removeContainer: true,
          onclone: function (clonedDocument) {
            clonedDocument.body.setAttribute('aria-hidden', 'true');
          },
          width: exportWidth,
          height: exportHeight,
          windowWidth: exportWidth,
          windowHeight: exportHeight,
          scrollX: 0,
          scrollY: 0
        });
        exportCard.remove();
        exportCard = null;
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
      if (exportCard) exportCard.remove();
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

  var restoredSharedPackage = restoreSharedPackageState();
  renderYoutubeDurations();
  var initialState = update();
  if (restoredSharedPackage && initialState.valid) {
    hasGeneratedCard = true;
    updateCard(initialState);
    result.hidden = false;
    downloadButton.disabled = false;
  }
}());
