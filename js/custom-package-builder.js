(function () {
  'use strict';

  var root = document.getElementById('custom-package-builder');
  if (!root) return;

  var PRICING = Object.freeze({
    managementFirstPlatform: 7000,
    managementAdditionalPlatform: 1000,
    staticPosts: Object.freeze({
      standardRate: 1000,
      bulkRate: 800,
      bulkRateStartsAt: 11
    }),
    video25: 2000,
    video50: 3000,
    story: 1400,
    aiVideo45: 3500,
    aiVideo90: 5500,
    maximumQuantity: 999
  });
  var QUOTATION_STORAGE_KEY = 'zyntra.customPackageQuotation.v1';
  var BUILDER_STORAGE_KEY = 'zyntra.customPackageBuilder.v1';
  var QUOTATION_VERSION = 1;
  var WHATSAPP_CONFIG = Object.freeze({
    companyNumber: '947046004033'
  });

  var form = root.querySelector('#custom-package-form');
  var managementToggle = root.querySelector('#custom-management-enabled');
  var platformsPanel = root.querySelector('#custom-platforms');
  var platformInputs = Array.prototype.slice.call(root.querySelectorAll('input[name="custom-platform"]'));
  var quantityInputs = {
    posts: root.querySelector('#custom-post-count'),
    video25: root.querySelector('#custom-video-25-count'),
    video50: root.querySelector('#custom-video-50-count'),
    stories: root.querySelector('#custom-story-count'),
    aiVideo45: root.querySelector('#custom-ai-video-45-count'),
    aiVideo90: root.querySelector('#custom-ai-video-90-count')
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
  var cardWhatsappContact = root.querySelector('#custom-card-whatsapp-contact');
  var downloadButton = root.querySelector('#custom-package-download');
  var downloadStatus = root.querySelector('#custom-package-download-status');
  var whatsappButton = root.querySelector('#custom-package-whatsapp');
  var whatsappButtonLabel = whatsappButton.querySelector('span');
  var whatsappStatus = root.querySelector('#custom-package-whatsapp-status');
  var shareButton = root.querySelector('#custom-package-share');
  var copyLinkButton = root.querySelector('#custom-package-copy-link');
  var shareStatus = root.querySelector('#custom-package-share-status');
  var draftSelection = null;
  var generatedSelection = null;
  var generatedTotal = null;
  var isGenerated = false;
  var isDirty = false;
  var isSharing = false;
  var isWhatsappSharing = false;
  var preparedWhatsappUrl = '';
  var whatsappResetTimer;
  var shareStatusTimer;
  var currentQuotationSnapshot = null;

  function formatLocalWhatsappNumber(internationalNumber) {
    var localNumber = internationalNumber.indexOf('94') === 0 ? '0' + internationalNumber.slice(2) : internationalNumber;
    return localNumber.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3');
  }

  cardWhatsappContact.textContent = 'Call / WhatsApp: ' + formatLocalWhatsappNumber(WHATSAPP_CONFIG.companyNumber);

  function formatRupees(amount) {
    return 'Rs. ' + amount.toLocaleString('en-US');
  }

  function readSessionJson(key) {
    try {
      var raw = window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeSessionJson(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getColomboDateParts(date) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date || new Date());
    var values = {};
    parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
    return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
  }

  function datePartsToIso(parts) {
    return String(parts.year).padStart(4, '0') + '-' + String(parts.month).padStart(2, '0') + '-' + String(parts.day).padStart(2, '0');
  }

  function addCalendarDays(isoDate, days) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return '';
    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function createQuotationReference(issueDate) {
    var randomPart = '';
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      var random = new Uint32Array(1);
      window.crypto.getRandomValues(random);
      randomPart = random[0].toString(36).slice(-5).padStart(5, '0').toUpperCase();
    } else {
      randomPart = (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(-5).toUpperCase();
    }
    return 'ZS-Q-' + issueDate.replace(/-/g, '') + '-' + randomPart;
  }

  function calculateStaticPostsPrice(quantity) {
    var postCount = Math.max(0, Math.floor(Number(quantity) || 0));

    if (postCount === 0) {
      return 0;
    }

    var ratePerPost = postCount < PRICING.staticPosts.bulkRateStartsAt
      ? PRICING.staticPosts.standardRate
      : PRICING.staticPosts.bulkRate;

    return postCount * ratePerPost;
  }

  function calculateAiVideosPrice(aiVideo45Quantity, aiVideo90Quantity) {
    var aiVideo45Count = Math.max(0, Math.floor(Number(aiVideo45Quantity) || 0));
    var aiVideo90Count = Math.max(0, Math.floor(Number(aiVideo90Quantity) || 0));

    return aiVideo45Count * PRICING.aiVideo45 + aiVideo90Count * PRICING.aiVideo90;
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
      if (typeof state.quoteOnly !== 'boolean') messages.push('YouTube long-form video editing will be quoted separately according to its duration and editing requirements.');
      else messages.push(state.quoteOnly
        ? 'Submit or share these requirements with Zyntra Studio to receive the final quotation.'
        : 'The package total does not include YouTube long-form video editing. Its final price will be confirmed separately.');
    }
    if (state.management && state.platforms.length) messages.push('Ad boosting support is included with your selected social media management package. Advertising spend/ad budget is not included and will be discussed separately.');
    else messages.push('Advertising spend and ad boosting management are not included in this content package.');
    return messages.join(' ');
  }

  function readDraftSelection() {
    var quantities = {};
    var quantitiesValid = true;
    Object.keys(quantityInputs).forEach(function (key) {
      var result = readQuantity(quantityInputs[key]);
      quantities[key] = result.value;
      quantitiesValid = quantitiesValid && result.valid;
    });
    var selectedPlatforms = platformInputs.filter(function (input) { return input.checked; }).map(function (input) { return input.value; });
    var management = managementToggle.checked;
    var mainContentCount = quantities.posts + quantities.video25 + quantities.video50 + quantities.aiVideo45 + quantities.aiVideo90;
    var youtube = getYoutubeState();
    var hasPrimaryContent = mainContentCount > 0 || youtube.valid;
    var valid = quantitiesValid && hasPrimaryContent && (!management || selectedPlatforms.length > 0) && (!youtube.enabled || youtube.valid);
    var message = 'Your package is ready to create.';
    if (!quantitiesValid) message = 'Enter whole-number quantities from 0 to ' + PRICING.maximumQuantity + '.';
    else if (youtube.enabled && !youtube.durationsValid) message = 'Enter a whole-number duration from 1 to 180 minutes for every YouTube video.';
    else if (youtube.enabled && !youtube.editingTypeValid) message = 'Select an editing type for YouTube long-form video editing.';
    else if (!hasPrimaryContent && quantities.stories > 0) message = 'Story videos are an add-on. Add a static post, professional video, AI video or valid YouTube long-form request.';
    else if (!hasPrimaryContent && management) message = 'Management requires a static post, professional video, AI video or valid YouTube long-form request.';
    else if (!hasPrimaryContent) message = 'Choose a static post, professional video, AI video or YouTube long-form editing request to create a package.';
    else if (management && selectedPlatforms.length === 0) message = 'Select at least one platform for social media management.';
    return { quantities: quantities, quantitiesValid: quantitiesValid, platforms: selectedPlatforms, management: management, youtube: youtube, valid: valid, message: message };
  }

  function calculatePackageTotal(selection) {
    var managementTotal = selection.management && selection.platforms.length
      ? PRICING.managementFirstPlatform + Math.max(selection.platforms.length - 1, 0) * PRICING.managementAdditionalPlatform
      : 0;
    var postTotal = calculateStaticPostsPrice(selection.quantities.posts);
    var aiVideoTotal = calculateAiVideosPrice(selection.quantities.aiVideo45, selection.quantities.aiVideo90);
    return managementTotal + postTotal + selection.quantities.video25 * PRICING.video25 + selection.quantities.video50 * PRICING.video50 + selection.quantities.stories * PRICING.story + aiVideoTotal;
  }

  function cloneSelection(selection) {
    return JSON.parse(JSON.stringify(selection));
  }

  function selectionKey(selection) {
    if (!selection) return '';
    return JSON.stringify({
      quantities: selection.quantities,
      platforms: selection.platforms,
      management: selection.management,
      youtube: {
        enabled: selection.youtube.enabled,
        videos: selection.youtube.videos,
        editingType: selection.youtube.editingType,
        addOns: selection.youtube.addOns
      }
    });
  }

  function createGeneratedState() {
    var state = cloneSelection(generatedSelection);
    state.total = generatedTotal;
    state.quoteOnly = state.youtube.enabled && generatedTotal === 0;
    return state;
  }

  function buildQuotationServices(state) {
    var services = [];
    function add(id, service, details) {
      services.push({ id: id, service: service, details: details });
    }
    if (state.quantities.posts > 0) add('posts', 'Static Posts', state.quantities.posts + (state.quantities.posts === 1 ? ' post' : ' posts'));
    if (state.quantities.video25 > 0) add('video25', 'Professional Videos', state.quantities.video25 + (state.quantities.video25 === 1 ? ' video' : ' videos') + ' · Up to 25 seconds each');
    if (state.quantities.video50 > 0) add('video50', 'Professional Videos', state.quantities.video50 + (state.quantities.video50 === 1 ? ' video' : ' videos') + ' · Up to 50 seconds each');
    if (state.quantities.stories > 0) add('stories', 'Simple Story Videos', state.quantities.stories + (state.quantities.stories === 1 ? ' story video' : ' story videos') + ' · Up to 20 seconds each');
    if (state.quantities.aiVideo45 > 0) add('aiVideo45', 'AI Videos', state.quantities.aiVideo45 + (state.quantities.aiVideo45 === 1 ? ' video' : ' videos') + ' · Up to 45 seconds each');
    if (state.quantities.aiVideo90 > 0) add('aiVideo90', 'AI Videos', state.quantities.aiVideo90 + (state.quantities.aiVideo90 === 1 ? ' video' : ' videos') + ' · Up to 1.5 minutes each');
    if (state.management && state.platforms.length) add('management', 'Social Media Management', 'Platforms: ' + state.platforms.join(', '));
    if (state.youtube.enabled) {
      var youtubeDetails = state.youtube.videoCount + (state.youtube.videoCount === 1 ? ' video' : ' videos') +
        ' · Durations: ' + state.youtube.videos.map(function (video) { return video.durationMinutes + ' min'; }).join(', ') +
        ' · ' + state.youtube.editingTypeLabel;
      if (state.youtube.addOns.length) youtubeDetails += ' · Add-ons: ' + state.youtube.addOns.map(function (key) { return YOUTUBE_ADDONS[key]; }).join(', ');
      add('youtube', 'YouTube Long-Form Editing', youtubeDetails);
    }
    return services;
  }

  function createQuotationSnapshot(state) {
    var issueDate = datePartsToIso(getColomboDateParts(new Date()));
    return {
      version: QUOTATION_VERSION,
      reference: createQuotationReference(issueDate),
      issueDate: issueDate,
      expiryDate: addCalendarDays(issueDate, 28),
      selection: cloneSelection(generatedSelection),
      services: buildQuotationServices(state),
      total: state.total,
      quoteOnly: state.quoteOnly,
      monthly: Boolean(state.management && state.platforms.length),
      hasQuoteOnlyService: Boolean(state.youtube.enabled),
      createdAt: new Date().toISOString()
    };
  }

  function saveBuilderState() {
    if (!draftSelection) return;
    writeSessionJson(BUILDER_STORAGE_KEY, {
      version: QUOTATION_VERSION,
      draft: cloneSelection(draftSelection),
      generated: generatedSelection ? cloneSelection(generatedSelection) : null,
      total: generatedTotal
    });
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
    if (state.quantities.aiVideo45 > 0) selectedItems.push(['AI Videos up to 45 seconds:', String(state.quantities.aiVideo45)]);
    if (state.quantities.aiVideo90 > 0) selectedItems.push(['AI Videos up to 1.5 minutes:', String(state.quantities.aiVideo90)]);
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
  }

  function updateDraftState() {
    draftSelection = readDraftSelection();
    isDirty = isGenerated && selectionKey(draftSelection) !== selectionKey(generatedSelection);

    validation.textContent = draftSelection.message;
    validation.classList.toggle('is-valid', draftSelection.valid);
    validation.classList.toggle('is-error', !draftSelection.valid && (draftSelection.quantities.stories > 0 || draftSelection.management || draftSelection.youtube.enabled || !draftSelection.quantitiesValid));
    createButton.disabled = !draftSelection.valid;
    createButton.textContent = 'Create My Package';
    notice.textContent = getPackageNotice(draftSelection);

    if (!isGenerated) {
      totalLabel.textContent = 'PACKAGE PRICING';
      totalOutput.textContent = 'Your final package total will be shown after you create the package.';
      result.hidden = true;
      downloadButton.hidden = true;
      downloadButton.disabled = true;
      whatsappButton.disabled = true;
      preparedWhatsappUrl = '';
    } else if (isDirty) {
      totalLabel.textContent = 'PACKAGE NEEDS UPDATE';
      totalOutput.textContent = 'Your selections have changed. Click Create My Package to update your quotation.';
      result.hidden = true;
      downloadButton.hidden = false;
      downloadButton.disabled = true;
      whatsappButton.disabled = true;
      downloadStatus.textContent = 'Your selections have changed. Click Create My Package to update your quotation.';
      preparedWhatsappUrl = '';
    } else {
      totalLabel.textContent = 'PACKAGE CREATED';
      totalOutput.textContent = 'Your final package total is shown in the quotation below.';
      result.hidden = false;
      downloadButton.hidden = false;
      downloadButton.disabled = isWhatsappSharing;
      whatsappButton.disabled = isWhatsappSharing;
    }
    saveBuilderState();
    return draftSelection;
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
    updateDraftState();
  }

  youtubeToggle.addEventListener('change', function () {
    youtubeLongForm.enabled = youtubeToggle.checked;
    youtubeDetails.hidden = !youtubeLongForm.enabled;
    updateDraftState();
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
    updateDraftState();
  });
  form.addEventListener('input', updateDraftState);
  form.addEventListener('change', updateDraftState);

  function addWholeQuantityInputGuards(input) {
    input.addEventListener('keydown', function (event) {
      if (['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault();
    });
    input.addEventListener('paste', function (event) {
      var pasted = event.clipboardData ? event.clipboardData.getData('text').trim() : '';
      if (!/^\d+$/.test(pasted) || Number(pasted) > PRICING.maximumQuantity) event.preventDefault();
    });
  }

  [quantityInputs.posts, quantityInputs.aiVideo45, quantityInputs.aiVideo90].forEach(addWholeQuantityInputGuards);

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
    updateDraftState();
    if (!draftSelection.valid) return;

    generatedSelection = cloneSelection(draftSelection);
    generatedTotal = calculatePackageTotal(generatedSelection);
    isGenerated = true;
    isDirty = false;

    var generatedState = createGeneratedState();
    currentQuotationSnapshot = createQuotationSnapshot(generatedState);
    writeSessionJson(QUOTATION_STORAGE_KEY, currentQuotationSnapshot);
    updateCard(generatedState);
    preparedWhatsappUrl = buildWhatsappUrl(buildWhatsAppMessage(generatedState, ''));
    downloadStatus.textContent = '';
    whatsappStatus.textContent = '';
    whatsappStatus.classList.remove('is-error');
    updateDraftState();
    result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  });

  function buildPackageBuilderUrl() {
    var url = new URL(window.location.href);
    var state = readDraftSelection();
    url.username = '';
    url.password = '';
    url.search = '';
    url.searchParams.set('zpkg', '1');
    url.searchParams.set('posts', String(state.quantities.posts));
    url.searchParams.set('video25', String(state.quantities.video25));
    url.searchParams.set('video50', String(state.quantities.video50));
    url.searchParams.set('stories', String(state.quantities.stories));
    url.searchParams.set('aiVideo45', String(state.quantities.aiVideo45));
    url.searchParams.set('aiVideo90', String(state.quantities.aiVideo90));
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
    quantityInputs.aiVideo45.value = String(readSharedInteger(params, 'aiVideo45', 0, PRICING.maximumQuantity, 0));
    quantityInputs.aiVideo90.value = String(readSharedInteger(params, 'aiVideo90', 0, PRICING.maximumQuantity, 0));

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

  function isSafeStoredSelection(selection) {
    if (!selection || !selection.quantities || !selection.youtube || !Array.isArray(selection.platforms)) return false;
    var quantitiesAreSafe = Object.keys(quantityInputs).every(function (key) {
      return Number.isSafeInteger(selection.quantities[key]) && selection.quantities[key] >= 0 && selection.quantities[key] <= PRICING.maximumQuantity;
    });
    var allowedPlatforms = platformInputs.map(function (input) { return input.value; });
    var platformsAreSafe = selection.platforms.length <= allowedPlatforms.length && selection.platforms.every(function (platform, index) {
      return allowedPlatforms.includes(platform) && selection.platforms.indexOf(platform) === index;
    });
    var youtube = selection.youtube;
    var youtubeSafe = typeof youtube.enabled === 'boolean' && Array.isArray(youtube.videos) && youtube.videos.length >= 1 && youtube.videos.length <= 20 &&
      youtube.videos.every(function (video) { return video && Number.isInteger(video.durationMinutes) && video.durationMinutes >= 1 && video.durationMinutes <= 180; }) &&
      (!youtube.enabled || Object.prototype.hasOwnProperty.call(YOUTUBE_EDITING_TYPES, youtube.editingType)) &&
      Array.isArray(youtube.addOns) && youtube.addOns.every(function (key) { return Object.prototype.hasOwnProperty.call(YOUTUBE_ADDONS, key); });
    return quantitiesAreSafe && platformsAreSafe && youtubeSafe && typeof selection.management === 'boolean';
  }

  function applySelectionToBuilder(selection) {
    Object.keys(quantityInputs).forEach(function (key) { quantityInputs[key].value = String(selection.quantities[key]); });
    managementToggle.checked = selection.management;
    platformsPanel.hidden = !selection.management;
    platformInputs.forEach(function (input) { input.checked = selection.management && selection.platforms.includes(input.value); });
    youtubeLongForm.enabled = selection.youtube.enabled;
    youtubeLongForm.videos = selection.youtube.videos.map(function (video) {
      return { durationMinutes: video.durationMinutes, inputValue: String(video.durationMinutes) };
    });
    youtubeLongForm.editingType = selection.youtube.editingType;
    Object.keys(YOUTUBE_ADDONS).forEach(function (key) { youtubeLongForm.addOns[key] = selection.youtube.addOns.includes(key); });
    youtubeToggle.checked = youtubeLongForm.enabled;
    youtubeDetails.hidden = !youtubeLongForm.enabled;
    youtubeEditingInputs.forEach(function (input) { input.checked = input.value === youtubeLongForm.editingType; });
    youtubeAddonInputs.forEach(function (input) { input.checked = Boolean(youtubeLongForm.addOns[input.value]); });
  }

  function restoreStoredBuilderState() {
    var stored = readSessionJson(BUILDER_STORAGE_KEY);
    if (!stored || stored.version !== QUOTATION_VERSION || !isSafeStoredSelection(stored.draft)) return false;
    applySelectionToBuilder(stored.draft);
    var snapshot = readSessionJson(QUOTATION_STORAGE_KEY);
    if (isSafeStoredSelection(stored.generated) && snapshot && snapshot.version === QUOTATION_VERSION &&
        selectionKey(snapshot.selection) === selectionKey(stored.generated)) {
      generatedSelection = cloneSelection(stored.generated);
      generatedTotal = calculatePackageTotal(generatedSelection);
      isGenerated = true;
      currentQuotationSnapshot = snapshot;
      var generatedState = createGeneratedState();
      updateCard(generatedState);
      preparedWhatsappUrl = buildWhatsappUrl(buildWhatsAppMessage(generatedState, ''));
    }
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

  function buildWhatsAppMessage(state, quotationUrl) {
    var lines = [
      'Hello Zyntra Studio,',
      '',
      'I created a custom package through your website. Please review my quotation.',
      ''
    ];
    if (state.platforms.length) lines.push('Platforms: ' + state.platforms.join(', '));
    if (state.quantities.posts > 0) lines.push('Static Posts: ' + state.quantities.posts);
    if (state.quantities.video25 > 0) lines.push('Professional Videos up to 25 seconds: ' + state.quantities.video25);
    if (state.quantities.video50 > 0) lines.push('Professional Videos up to 50 seconds: ' + state.quantities.video50);
    if (state.quantities.stories > 0) lines.push('Simple Story Videos: ' + state.quantities.stories);
    if (state.quantities.aiVideo45 > 0) lines.push('AI Videos up to 45 seconds: ' + state.quantities.aiVideo45);
    if (state.quantities.aiVideo90 > 0) lines.push('AI Videos up to 1.5 minutes: ' + state.quantities.aiVideo90);
    if (state.youtube.enabled) {
      var youtubeDetails = state.youtube.videoCount + (state.youtube.videoCount === 1 ? ' video' : ' videos') +
        '; durations: ' + state.youtube.videos.map(function (video) { return video.durationMinutes + ' min'; }).join(', ') +
        '; editing: ' + state.youtube.editingTypeLabel;
      if (state.youtube.addOns.length) youtubeDetails += '; requirements: ' + state.youtube.addOns.map(function (key) { return YOUTUBE_ADDONS[key]; }).join(', ');
      lines.push('YouTube Long-Form Videos: ' + youtubeDetails);
    }
    if (state.management) lines.push('Social Media Management: Included');
    lines.push('', 'FINAL PACKAGE TOTAL', state.quoteOnly ? 'CUSTOM QUOTE REQUIRED' : formatRupees(state.total));
    if (quotationUrl) lines.push('', 'Quotation Image: ' + quotationUrl);
    lines.push('', 'I would like to discuss this package.');
    return lines.join('\n');
  }

  function buildWhatsappUrl(message) {
    return 'https://wa.me/' + WHATSAPP_CONFIG.companyNumber + '?text=' + encodeURIComponent(message);
  }

  function resetWhatsAppButton() {
    if (whatsappResetTimer) window.clearTimeout(whatsappResetTimer);
    whatsappResetTimer = null;
    isWhatsappSharing = false;
    whatsappButtonLabel.textContent = 'Send to WhatsApp';
    updateDraftState();
  }

  downloadButton.addEventListener('click', function () {
    if (isWhatsappSharing) return;
    updateDraftState();
    if (!isGenerated || isDirty) return;
    if (!currentQuotationSnapshot || !writeSessionJson(QUOTATION_STORAGE_KEY, currentQuotationSnapshot)) {
      downloadStatus.textContent = 'The quotation preview is unavailable because this browser could not save the generated quotation. Please allow session storage and try again.';
      return;
    }
    window.location.assign('quotation.html');
  });

  whatsappButton.addEventListener('click', function () {
    if (isWhatsappSharing) return;
    updateDraftState();
    if (!isGenerated || isDirty || !preparedWhatsappUrl) {
      whatsappStatus.textContent = isGenerated
        ? 'Your selections have changed. Update your package before sharing.'
        : 'Create your package before sharing it.';
      whatsappStatus.classList.add('is-error');
      return;
    }
    isWhatsappSharing = true;
    whatsappButton.disabled = true;
    whatsappStatus.classList.remove('is-error');
    whatsappStatus.textContent = '';
    whatsappButtonLabel.textContent = 'Opening WhatsApp…';

    var whatsappUrl = preparedWhatsappUrl;
    whatsappResetTimer = window.setTimeout(resetWhatsAppButton, 1500);
    window.location.assign(whatsappUrl);
  });

  window.addEventListener('pageshow', resetWhatsAppButton);

  var restoredSharedPackage = restoreSharedPackageState();
  if (!restoredSharedPackage) restoreStoredBuilderState();
  renderYoutubeDurations();
  updateDraftState();
}());
