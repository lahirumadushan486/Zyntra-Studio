/* Zyntra Studio — interactions, accessibility and ambient effects */
// Central brand logo configuration — replace only this value when the final logo URL is ready.
const BRAND_LOGO_URL = "https://res.cloudinary.com/tqdnopaj/image/upload/v1788956884/1080x1080_logo.jpg";

// Public Supabase configuration for customer reviews. Never place a service_role key here.
const SUPABASE_URL = "PASTE_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_PUBLISHABLE_KEY = "PASTE_SUPABASE_PUBLISHABLE_KEY_HERE";
const REVIEW_AUTO_PUBLISH = true;

// Editable placeholder content. Replace these clearly labelled samples with authentic reviews.
const SAMPLE_CUSTOMER_REVIEWS = [
  { id: 'sample-review-01', customerName: 'Customer 01', reviewText: 'Sample review — replace this with an authentic customer review.', rating: 5, photoUrl: '', createdAt: '2026-01-01' },
  { id: 'sample-review-02', customerName: 'Customer 02', reviewText: 'Sample review — replace this with an authentic customer review.', rating: 4, photoUrl: '', createdAt: '2026-01-02' },
  { id: 'sample-review-03', customerName: 'Customer 03', reviewText: 'Sample review — replace this with an authentic customer review.', rating: 5, photoUrl: '', createdAt: '2026-01-03' },
  { id: 'sample-review-04', customerName: 'Customer 04', reviewText: 'Sample review — replace this with an authentic customer review.', rating: 4, photoUrl: '', createdAt: '2026-01-04' },
  { id: 'sample-review-05', customerName: 'Customer 05', reviewText: 'Sample review — replace this with an authentic customer review.', rating: 5, photoUrl: '', createdAt: '2026-01-05' }
];

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  function initializeBrandLogos() {
    var lockups = Array.prototype.slice.call(document.querySelectorAll('[data-brand-logo]'));
    var favicon = document.getElementById('brand-favicon');
    var hasConfiguredLogo = BRAND_LOGO_URL && BRAND_LOGO_URL.indexOf('PASTE_') !== 0;

    function showFallback(lockup) {
      var image = lockup.querySelector('.brand-logo-image');
      var fallback = lockup.querySelector('.brand-logo-fallback');
      if (image) image.hidden = true;
      if (fallback) fallback.hidden = false;
    }

    function loadLogo(lockup) {
      var image = lockup.querySelector('.brand-logo-image');
      var fallback = lockup.querySelector('.brand-logo-fallback');
      if (!image || !fallback) return;
      image.addEventListener('load', function () {
        image.hidden = false;
        fallback.hidden = true;
      }, { once: true });
      image.addEventListener('error', function () {
        showFallback(lockup);
      }, { once: true });
      image.src = BRAND_LOGO_URL;
      if (image.complete && image.naturalWidth > 0) {
        image.hidden = false;
        fallback.hidden = true;
      }
    }

    lockups.forEach(showFallback);
    if (!hasConfiguredLogo) return;

    var logoProbe = new Image();
    logoProbe.addEventListener('load', function () {
      lockups.forEach(loadLogo);
      if (favicon) favicon.href = BRAND_LOGO_URL;
    }, { once: true });
    logoProbe.addEventListener('error', function () {
      lockups.forEach(showFallback);
    }, { once: true });
    logoProbe.src = BRAND_LOGO_URL;
  }

  initializeBrandLogos();

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var isReduced = reducedMotion.matches;
  var isTouch = window.matchMedia('(pointer: coarse)').matches;
  var header = document.getElementById('site-header');
  var nav = document.getElementById('main-nav');
  var hamburger = document.getElementById('hamburger');
  var progress = document.getElementById('scroll-progress');
  var backToTop = document.getElementById('back-to-top');

  document.getElementById('year').textContent = new Date().getFullYear();

  function openMenu() {
    nav.classList.add('is-open');
    hamburger.classList.add('is-open');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Close menu');
  }

  function closeMenu() {
    nav.classList.remove('is-open');
    hamburger.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Open menu');
  }

  function scrollToSection(hash, smooth) {
    var target = hash ? document.querySelector(hash) : document.getElementById('home');
    if (!target) return false;
    var offset = header.offsetHeight + 32;
    var top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: smooth && !isReduced ? 'smooth' : 'auto' });
    setActiveNav(target.id);
    return true;
  }

  hamburger.addEventListener('click', function () {
    nav.classList.contains('is-open') ? closeMenu() : openMenu();
  });

  document.addEventListener('click', function (event) {
    if (nav.classList.contains('is-open') && !header.contains(event.target)) closeMenu();
  });

  document.querySelectorAll('[data-nav]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var href = link.getAttribute('href');
      if (!href) return;
      var hash = href.charAt(0) === '#' ? href : '';
      if (!hash && document.body.getAttribute('data-page') === 'home' && href.indexOf('index.html#') === 0) {
        hash = href.slice('index.html'.length);
      }
      if (!hash) {
        closeMenu();
        return;
      }
      var target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      closeMenu();
      if (window.location.hash !== hash) window.history.pushState(null, '', hash);
      scrollToSection(hash, true);
    });
  });

  function updateScrollUI() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 28);
    backToTop.classList.toggle('is-visible', y > 600);
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (scrollable > 0 ? Math.min(1, y / scrollable) : 0) + ')';
  }

  updateScrollUI();
  window.addEventListener('scroll', updateScrollUI, { passive: true });
  backToTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: isReduced ? 'auto' : 'smooth' });
  });

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link[data-nav]'));
  var observedSections = document.querySelectorAll('main section[id]');
  var navAliases = { 'mobile-shooting': 'services', process: 'services', 'services-full': 'services', 'packages-full': 'packages', faq: 'about' };

  function setActiveNav(id) {
    var activeId = navAliases[id] || id;
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var hashIndex = href.indexOf('#');
      var linkSection = hashIndex >= 0 ? href.slice(hashIndex + 1) : '';
      var active = activeId === 'offers' ? href === 'offers.html' : linkSection === activeId;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  if (document.body.getAttribute('data-page') === 'home') {
    requestAnimationFrame(function () {
      scrollToSection(window.location.hash || '#home', false);
    });
    window.addEventListener('load', function () {
      if (window.location.hash) scrollToSection(window.location.hash, false);
    }, { once: true });
    window.addEventListener('popstate', function () {
      scrollToSection(window.location.hash || '#home', false);
      closeMenu();
    });
  }

  if ('IntersectionObserver' in window) {
    var activeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActiveNav(entry.target.id);
      });
    }, { rootMargin: '-30% 0px -62% 0px', threshold: 0 });
    observedSections.forEach(function (section) { activeObserver.observe(section); });
  } else setActiveNav('home');

  var revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !isReduced) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealElements.forEach(function (element) { revealObserver.observe(element); });
  } else revealElements.forEach(function (element) { element.classList.add('is-visible'); });

  document.querySelectorAll('.accordion-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var panel = trigger.parentElement.nextElementSibling;
      var willOpen = trigger.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('.accordion-trigger').forEach(function (other) {
        if (other === trigger) return;
        other.setAttribute('aria-expanded', 'false');
        var otherPanel = other.parentElement.nextElementSibling;
        if (!otherPanel.hidden && !isReduced && otherPanel.animate) {
          var closing = otherPanel.animate([{ height: otherPanel.scrollHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 220, easing: 'ease' });
          closing.onfinish = function () { otherPanel.hidden = true; };
        } else otherPanel.hidden = true;
      });
      trigger.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        panel.hidden = false;
        if (!isReduced && panel.animate) panel.animate([{ height: '0px', opacity: 0 }, { height: panel.scrollHeight + 'px', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else if (!isReduced && panel.animate) {
        var animation = panel.animate([{ height: panel.scrollHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 220, easing: 'ease' });
        animation.onfinish = function () { panel.hidden = true; };
      } else panel.hidden = true;
    });
  });

  var filterButtons = document.querySelectorAll('.filter-btn');
  var portfolioCards = document.querySelectorAll('.portfolio-card');

  function selectPortfolioCard(selectedCard) {
    portfolioCards.forEach(function (card) {
      card.classList.toggle('is-selected', card === selectedCard);
    });
  }

  portfolioCards.forEach(function (card) {
    card.addEventListener('click', function () { selectPortfolioCard(card); });

    if (!isReduced && !isTouch && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      card.addEventListener('pointermove', function (event) {
        var bounds = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', event.clientX - bounds.left + 'px');
        card.style.setProperty('--mouse-y', event.clientY - bounds.top + 'px');
        card.classList.add('is-pointer-active');
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-pointer-active');
      }, { passive: true });
    }
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.portfolio-card')) selectPortfolioCard(null);
  });

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var filter = button.getAttribute('data-filter');
      filterButtons.forEach(function (item) {
        item.classList.toggle('is-active', item === button);
        item.setAttribute('aria-selected', String(item === button));
      });
      portfolioCards.forEach(function (card) {
        var visible = filter === 'all' || card.getAttribute('data-category') === filter;
        if (card._portfolioFilterTimer) window.clearTimeout(card._portfolioFilterTimer);
        if (isReduced || !card.animate) {
          card.classList.toggle('is-hidden', !visible);
          return;
        }
        if (visible) {
          card.classList.remove('is-hidden');
          card.animate([
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ], { duration: 180, easing: 'ease-out' });
        } else if (!card.classList.contains('is-hidden')) {
          card.animate([
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-4px)' }
          ], { duration: 150, easing: 'ease-in' });
          card._portfolioFilterTimer = window.setTimeout(function () {
            card.classList.add('is-hidden');
          }, 150);
        }
      });
    });
  });

  var modalOverlay = document.getElementById('modal-overlay');
  var modalClose = document.getElementById('modal-close');
  var modalImage = document.getElementById('modal-img');
  var lastFocused = null;

  function openModal(card) {
    var source = card.querySelector('img');
    var trigger = card.querySelector('[data-modal-open]');
    modalImage.src = source.currentSrc || source.src;
    modalImage.alt = source.alt;
    document.getElementById('modal-title').textContent = trigger.getAttribute('data-title');
    document.getElementById('modal-type').textContent = trigger.getAttribute('data-type');
    document.getElementById('modal-service').textContent = trigger.getAttribute('data-service');
    document.getElementById('modal-direction').textContent = trigger.getAttribute('data-direction');
    document.getElementById('modal-deliverables').textContent = trigger.getAttribute('data-deliverables');
    lastFocused = document.activeElement;
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      modalOverlay.classList.add('is-open');
      modalClose.focus();
    });
  }

  function closeModal() {
    modalOverlay.classList.remove('is-open');
    window.setTimeout(function () {
      modalOverlay.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    }, isReduced ? 0 : 280);
  }

  document.querySelectorAll('[data-modal-open]').forEach(function (trigger) {
    trigger.addEventListener('click', function () { openModal(trigger.closest('.portfolio-card')); });
  });
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) modalOverlay.addEventListener('click', function (event) { if (event.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (modalOverlay && !modalOverlay.hidden) closeModal();
      else if (nav.classList.contains('is-open')) closeMenu();
    }
    if (event.key === 'Tab' && modalOverlay && !modalOverlay.hidden) {
      var focusables = modalOverlay.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  var whatsappNumber = '94706004033';
  document.querySelectorAll('.pkg-whatsapp').forEach(function (button) {
    button.addEventListener('click', function () {
      var selectedPackage = button.getAttribute('data-package');
      var message = 'Hi Zyntra Studio! I’m interested in the ' + selectedPackage + ' package. My business name is ______. Please send me more information.';
      window.open('https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
    });
  });

  function initializePackageSharing() {
    var packageCards = document.querySelectorAll('.package-card');
    if (!packageCards.length) return;

    var popover = document.createElement('div');
    popover.className = 'package-share-popover';
    popover.id = 'package-share-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    popover.setAttribute('aria-labelledby', 'package-share-popover-title');
    popover.hidden = true;
    popover.innerHTML =
      '<p class="package-share-popover__title" id="package-share-popover-title"></p>' +
      '<div class="package-share-popover__actions">' +
        '<button class="package-share-option package-share-copy" type="button">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>' +
          '<span>Copy Link</span>' +
        '</button>' +
        '<button class="package-share-option package-share-native" type="button">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"></path></svg>' +
          '<span>Share</span>' +
        '</button>' +
      '</div>';

    var toast = document.createElement('div');
    toast.className = 'package-share-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    document.body.appendChild(popover);
    document.body.appendChild(toast);

    var copyOption = popover.querySelector('.package-share-copy');
    var copyLabel = copyOption.querySelector('span');
    var nativeOption = popover.querySelector('.package-share-native');
    var popoverTitle = popover.querySelector('.package-share-popover__title');
    var openTrigger = null;
    var activePackage = null;
    var toastTimer = 0;
    var copyResetTimer = 0;
    var highlightTimer = 0;
    var pendingSharedPackageId = null;

    nativeOption.hidden = typeof navigator.share !== 'function';

    function slugifyPackageName(name) {
      return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function createShareButton(card) {
      var nameNode = card.querySelector('h3');
      var packageName = nameNode ? nameNode.textContent.trim() : 'package';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'package-share-trigger';
      button.setAttribute('aria-label', 'Share ' + packageName);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', popover.id);
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"></path></svg>';
      return button;
    }

    function enhancePackageCards(root) {
      var scope = root && root.querySelectorAll ? root : document;
      var cards = Array.prototype.slice.call(scope.querySelectorAll('.package-card:not([data-share-ready])'));
      if (scope.matches && scope.matches('.package-card:not([data-share-ready])')) cards.unshift(scope);
      cards.forEach(function (card) {
        var nameNode = card.querySelector('h3');
        var packageId = card.getAttribute('data-package-id') || slugifyPackageName(nameNode ? nameNode.textContent : 'package');
        card.setAttribute('data-package-id', packageId);
        card.setAttribute('data-share-ready', 'true');

        var footer = document.createElement('div');
        footer.className = 'package-card__footer';
        var primaryAction = card.querySelector('.pkg-whatsapp');
        if (primaryAction) footer.appendChild(primaryAction);
        footer.appendChild(createShareButton(card));
        card.appendChild(footer);
      });
    }

    function getPackageData(card) {
      var nameNode = card.querySelector('h3');
      var priceNode = card.querySelector('.price');
      var descriptionNode = card.querySelector('li');
      var url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('package', card.getAttribute('data-package-id'));
      url.hash = 'packages';
      return {
        name: nameNode ? nameNode.textContent.trim() : 'Zyntra Studio package',
        price: priceNode ? priceNode.textContent.trim().replace(/\s+/g, ' ') : '',
        description: descriptionNode ? descriptionNode.textContent.trim() : '',
        url: url.toString()
      };
    }

    function positionSharePopover() {
      if (!openTrigger || popover.hidden) return;
      if (window.matchMedia('(max-width: 560px)').matches) {
        popover.style.removeProperty('top');
        popover.style.removeProperty('left');
        return;
      }
      var triggerRect = openTrigger.getBoundingClientRect();
      var popoverRect = popover.getBoundingClientRect();
      var gap = 10;
      var left = Math.min(window.innerWidth - popoverRect.width - 12, Math.max(12, triggerRect.right - popoverRect.width));
      var top = triggerRect.top - popoverRect.height - gap;
      if (top < 12) top = triggerRect.bottom + gap;
      if (top + popoverRect.height > window.innerHeight - 12) top = Math.max(12, window.innerHeight - popoverRect.height - 12);
      popover.style.left = left + 'px';
      popover.style.top = top + 'px';
    }

    function closeSharePopover(restoreFocus) {
      if (!openTrigger) return;
      var trigger = openTrigger;
      trigger.setAttribute('aria-expanded', 'false');
      popover.hidden = true;
      openTrigger = null;
      activePackage = null;
      if (restoreFocus) trigger.focus();
    }

    function openSharePopover(trigger, card) {
      if (openTrigger && openTrigger !== trigger) closeSharePopover(false);
      openTrigger = trigger;
      activePackage = card;
      var data = getPackageData(card);
      popoverTitle.textContent = data.name;
      copyLabel.textContent = 'Copy Link';
      window.clearTimeout(copyResetTimer);
      trigger.setAttribute('aria-expanded', 'true');
      popover.hidden = false;
      positionSharePopover();
      copyOption.focus();
    }

    function fallbackCopy(text) {
      var activeElement = document.activeElement;
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
      textarea.remove();
      if (activeElement && activeElement.focus) activeElement.focus();
      return copied;
    }

    function copyPackageUrl(url) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(url).then(function () { return true; }, function () { return fallbackCopy(url); });
      }
      return Promise.resolve(fallbackCopy(url));
    }

    function showShareToast(message) {
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add('is-visible');
      toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 2200);
    }

    function findPackageCard(packageId) {
      return Array.prototype.find.call(document.querySelectorAll('.package-card[data-package-id]'), function (card) {
        return card.getAttribute('data-package-id') === packageId;
      }) || null;
    }

    function highlightSharedPackage(packageId, smooth) {
      var card = findPackageCard(packageId);
      if (!card) return false;
      window.clearTimeout(highlightTimer);
      document.querySelectorAll('.package-card.is-shared-package').forEach(function (highlightedCard) {
        highlightedCard.classList.remove('is-shared-package');
      });
      card.classList.add('is-visible', 'is-shared-package');
      var cardRect = card.getBoundingClientRect();
      var cardTop = cardRect.top + window.scrollY;
      var headerClearance = header.offsetHeight + 32;
      var centeredTop = cardTop - Math.max(0, (window.innerHeight - cardRect.height) / 2);
      var top = Math.min(centeredTop, cardTop - headerClearance);
      window.scrollTo({ top: Math.max(0, top), behavior: smooth && !isReduced ? 'smooth' : 'auto' });
      setActiveNav('packages');
      highlightTimer = window.setTimeout(function () { card.classList.remove('is-shared-package'); }, 3800);
      return true;
    }

    function prepareSharedPackage(smooth) {
      var params = new URLSearchParams(window.location.search);
      pendingSharedPackageId = params.get('package');
      if (!pendingSharedPackageId) return;
      window.requestAnimationFrame(function () {
        if (highlightSharedPackage(pendingSharedPackageId, smooth)) pendingSharedPackageId = null;
      });
    }

    enhancePackageCards(document);

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('.package-share-trigger');
      if (trigger) {
        var card = trigger.closest('.package-card');
        if (!card) return;
        if (openTrigger === trigger) closeSharePopover(true);
        else openSharePopover(trigger, card);
        return;
      }
      if (!popover.hidden && !popover.contains(event.target)) closeSharePopover(false);
    });

    copyOption.addEventListener('click', function () {
      if (!activePackage) return;
      var url = getPackageData(activePackage).url;
      var copiedTrigger = openTrigger;
      copyPackageUrl(url).then(function (copied) {
        if (!copied) {
          showShareToast('Unable to copy package link');
          closeSharePopover(true);
          return;
        }
        copyLabel.textContent = 'Link Copied!';
        showShareToast('Package link copied');
        copyResetTimer = window.setTimeout(function () { copyLabel.textContent = 'Copy Link'; }, 2000);
        window.setTimeout(function () {
          if (openTrigger === copiedTrigger) closeSharePopover(true);
        }, 450);
      });
    });

    nativeOption.addEventListener('click', function () {
      if (!activePackage || typeof navigator.share !== 'function') return;
      var data = getPackageData(activePackage);
      var shareText = 'Zyntra Studio – ' + data.name + '\n\n' + data.description + '\nPrice: ' + data.price + '\n\nView full package details:';
      closeSharePopover(true);
      navigator.share({ title: 'Zyntra Studio – ' + data.name, text: shareText, url: data.url }).catch(function (error) {
        if (!error || error.name !== 'AbortError') showShareToast('Unable to open sharing options');
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !popover.hidden) {
        event.preventDefault();
        closeSharePopover(true);
      }
    });
    window.addEventListener('resize', positionSharePopover, { passive: true });
    window.addEventListener('scroll', positionSharePopover, { passive: true });
    window.addEventListener('popstate', function () {
      closeSharePopover(false);
      prepareSharedPackage(false);
    });

    if ('MutationObserver' in window) {
      var packageObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (node.nodeType === 1) enhancePackageCards(node);
          });
        });
        if (pendingSharedPackageId && highlightSharedPackage(pendingSharedPackageId, false)) pendingSharedPackageId = null;
      });
      packageObserver.observe(document.getElementById('main'), { childList: true, subtree: true });
    }

    if (document.readyState === 'complete') prepareSharedPackage(false);
    else window.addEventListener('load', function () { prepareSharedPackage(false); }, { once: true });
  }

  initializePackageSharing();

  function initializeCustomerReviews() {
    var reviewsTrack = document.getElementById('reviews-track');
    var reviewsViewport = document.getElementById('reviews-viewport');
    var addReviewButton = document.getElementById('add-review-button');
    var reviewModalOverlay = document.getElementById('review-modal-overlay');
    var reviewModalClose = document.getElementById('review-modal-close');
    var reviewCancel = document.getElementById('review-cancel');
    var reviewForm = document.getElementById('review-form');
    if (!reviewsTrack || !reviewsViewport || !addReviewButton || !reviewModalOverlay || !reviewForm) return;

    // Escape <main>'s stacking context so the fixed dialog always sits above the sticky header.
    document.body.appendChild(reviewModalOverlay);
    document.body.appendChild(document.getElementById('review-toast'));

    var reviewName = document.getElementById('review-customer-name');
    var reviewText = document.getElementById('review-text');
    var reviewPhoto = document.getElementById('review-photo');
    var reviewPhotoPreview = document.getElementById('review-photo-preview');
    var reviewPhotoPreviewImage = document.getElementById('review-photo-preview-image');
    var reviewPhotoPreviewName = document.getElementById('review-photo-preview-name');
    var reviewPhotoChange = document.getElementById('review-photo-change');
    var reviewPhotoRemove = document.getElementById('review-photo-remove');
    var reviewCharacterCount = document.getElementById('review-character-count');
    var reviewStatus = document.getElementById('review-form-status');
    var reviewSubmit = document.getElementById('review-submit');
    var reviewFormBody = reviewForm.querySelector('.review-form__body');
    var reviewSubmitLabel = reviewSubmit.querySelector('.review-submit__label');
    var reviewToast = document.getElementById('review-toast');
    var ratingInputs = Array.prototype.slice.call(document.querySelectorAll('.review-rating-input'));
    var ratingLabels = Array.prototype.slice.call(document.querySelectorAll('.review-rating-options label'));
    var reviews = SAMPLE_CUSTOMER_REVIEWS.slice();
    var reviewLastFocused = null;
    var reviewPhotoBlob = null;
    var reviewPhotoObjectUrl = '';
    var photoProcessing = false;
    var submittingReview = false;
    var lastReviewSubmission = 0;
    var reviewToastTimer = 0;
    var marqueeResumeTimer = 0;
    var reviewHighlightTimer = 0;
    var reviewLayoutFrame = 0;
    var reviewPageScrollY = 0;

    function normalizeCustomerText(value) {
      return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function escapeAvatarText(value) {
      return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function getInitials(name) {
      var parts = normalizeCustomerText(name).split(' ').filter(Boolean);
      var initials = parts.slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join('');
      return initials || 'ZS';
    }

    function createFallbackAvatar(name) {
      var initials = escapeAvatarText(getInitials(name));
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2864ff"/><stop offset="1" stop-color="#806dff"/></linearGradient></defs><rect width="144" height="144" rx="72" fill="#071126"/><circle cx="72" cy="72" r="66" fill="url(#g)"/><text x="72" y="82" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="42" font-weight="700">' + initials + '</text></svg>';
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    function safeReviewPhotoUrl(url, name) {
      if (!url) return createFallbackAvatar(name);
      try {
        var parsed = new URL(url, window.location.href);
        if (parsed.protocol === 'https:' || (parsed.origin === window.location.origin && parsed.protocol === window.location.protocol)) return parsed.href;
      } catch (error) { /* Use the generated fallback below. */ }
      return createFallbackAvatar(name);
    }

    function createStarIcon(selected) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add(selected ? 'is-selected' : 'is-muted');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm12 2.8 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 2.8Z');
      svg.appendChild(path);
      return svg;
    }

    function formatReviewDate(value) {
      if (!value) return '';
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    }

    function createReviewCard(review, decorative) {
      var card = document.createElement('article');
      card.className = 'review-card';
      card.setAttribute('data-review-id', String(review.id));
      if (decorative) card.setAttribute('aria-hidden', 'true');

      var top = document.createElement('div');
      top.className = 'review-card__top';
      var photo = document.createElement('img');
      photo.className = 'review-card__photo';
      photo.width = 54;
      photo.height = 54;
      photo.loading = 'lazy';
      photo.alt = decorative ? '' : normalizeCustomerText(review.customerName) + ' profile photo';
      photo.src = safeReviewPhotoUrl(review.photoUrl, review.customerName);
      photo.addEventListener('error', function () {
        photo.src = createFallbackAvatar(review.customerName);
      }, { once: true });

      var identity = document.createElement('div');
      identity.className = 'review-card__identity';
      var name = document.createElement('h3');
      name.textContent = normalizeCustomerText(review.customerName);
      var stars = document.createElement('div');
      stars.className = 'review-card__stars';
      stars.setAttribute('aria-label', 'Rated ' + review.rating + ' out of 5');
      for (var starIndex = 1; starIndex <= 5; starIndex += 1) stars.appendChild(createStarIcon(starIndex <= review.rating));
      identity.appendChild(name);
      identity.appendChild(stars);
      top.appendChild(photo);
      top.appendChild(identity);

      var text = document.createElement('p');
      text.className = 'review-card__text';
      text.textContent = normalizeCustomerText(review.reviewText);
      var dateText = formatReviewDate(review.createdAt);
      var date = document.createElement('time');
      date.className = 'review-card__date';
      if (dateText) {
        date.dateTime = String(review.createdAt);
        date.textContent = dateText;
      }

      card.appendChild(top);
      card.appendChild(text);
      if (dateText) card.appendChild(date);

      if (normalizeCustomerText(review.reviewText).length > 180) {
        var readMore = document.createElement('button');
        readMore.className = 'review-card__more';
        readMore.type = 'button';
        readMore.textContent = 'Read more';
        readMore.tabIndex = decorative ? -1 : 0;
        readMore.addEventListener('click', function () {
          var expanded = card.classList.toggle('is-expanded');
          readMore.textContent = expanded ? 'Show less' : 'Read more';
          readMore.setAttribute('aria-expanded', String(expanded));
          reviewsTrack.classList.add('is-paused');
        });
        readMore.setAttribute('aria-expanded', 'false');
        card.insertBefore(readMore, dateText ? date : null);
      }
      return card;
    }

    function createReviewGroup(decorative) {
      var group = document.createElement('div');
      group.className = 'reviews-group';
      if (decorative) group.setAttribute('aria-hidden', 'true');
      for (var sequence = 0; sequence < 2; sequence += 1) {
        reviews.forEach(function (review) {
          group.appendChild(createReviewCard(review, decorative || sequence > 0));
        });
      }
      return group;
    }

    function updateMarqueeDuration() {
      var group = reviewsTrack.querySelector('.reviews-group');
      if (!group) return;
      var minimum = window.innerWidth <= 560 ? 45 : 55;
      reviewsTrack.style.setProperty('--reviews-duration', Math.max(minimum, group.scrollWidth / 28).toFixed(2) + 's');
    }

    function updateReviewLayout() {
      var viewportStyles = window.getComputedStyle(reviewsViewport);
      var horizontalPadding = parseFloat(viewportStyles.paddingLeft) + parseFloat(viewportStyles.paddingRight);
      var availableWidth = Math.max(240, reviewsViewport.clientWidth - horizontalPadding);
      var gap = window.innerWidth <= 560 ? 13 : 18;
      var cardWidth;
      if (window.innerWidth <= 600) cardWidth = availableWidth;
      else if (window.innerWidth <= 800) cardWidth = (availableWidth - gap) / 2;
      else if (window.innerWidth <= 1400) cardWidth = Math.min(400, (availableWidth - gap * 2) / 3);
      else cardWidth = Math.min(380, (availableWidth - gap * 3) / 4);
      reviewsTrack.style.setProperty('--review-card-width', Math.floor(cardWidth) + 'px');
      updateMarqueeDuration();
    }

    function requestReviewLayout() {
      window.cancelAnimationFrame(reviewLayoutFrame);
      reviewLayoutFrame = window.requestAnimationFrame(updateReviewLayout);
    }

    function renderReviews(newReviewId) {
      reviewsTrack.classList.add('is-rebuilding');
      reviewsTrack.style.animation = 'none';
      reviewsTrack.replaceChildren(createReviewGroup(false), createReviewGroup(true));
      reviewsTrack.classList.remove('is-paused');
      reviewsTrack.querySelectorAll('.review-card__photo').forEach(function (photo) {
        if (!photo.complete) {
          photo.addEventListener('load', requestReviewLayout, { once: true });
          photo.addEventListener('error', requestReviewLayout, { once: true });
        }
      });
      requestAnimationFrame(function () {
        updateReviewLayout();
        void reviewsTrack.offsetWidth;
        reviewsTrack.style.removeProperty('animation');
        window.requestAnimationFrame(function () { reviewsTrack.classList.remove('is-rebuilding'); });
        if (!newReviewId) return;
        var newCard = Array.prototype.find.call(reviewsTrack.querySelectorAll('.reviews-group:not([aria-hidden]) .review-card'), function (card) {
          return card.getAttribute('data-review-id') === String(newReviewId);
        });
        if (!newCard) return;
        window.clearTimeout(reviewHighlightTimer);
        newCard.classList.add('is-new-review');
        reviewHighlightTimer = window.setTimeout(function () { newCard.classList.remove('is-new-review'); }, 3600);
      });
    }

    function isSupabaseConfigured() {
      return SUPABASE_URL.indexOf('PASTE_') !== 0 && SUPABASE_PUBLISHABLE_KEY.indexOf('PASTE_') !== 0;
    }

    function supabaseHeaders(extraHeaders) {
      return Object.assign({
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY
      }, extraHeaders || {});
    }

    function mapDatabaseReview(record) {
      return {
        id: record.id,
        customerName: record.customer_name,
        reviewText: record.review_text,
        rating: Number(record.rating),
        photoUrl: record.photo_url || '',
        createdAt: record.created_at
      };
    }

    function loadApprovedReviews() {
      if (!isSupabaseConfigured()) return;
      var endpoint = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/customer_reviews?select=id,customer_name,review_text,rating,photo_url,created_at&status=eq.approved&order=created_at.desc';
      fetch(endpoint, { headers: supabaseHeaders() }).then(function (response) {
        if (!response.ok) throw new Error('Reviews could not be loaded.');
        return response.json();
      }).then(function (records) {
        var existingIds = new Set(reviews.map(function (review) { return String(review.id); }));
        records.map(mapDatabaseReview).forEach(function (review) {
          if (!existingIds.has(String(review.id))) reviews.unshift(review);
        });
        renderReviews();
      }).catch(function () {
        /* Keep the transparent sample reviews visible if the public service is unavailable. */
      });
    }

    function pauseMarquee() {
      window.clearTimeout(marqueeResumeTimer);
      reviewsTrack.classList.add('is-paused');
    }

    function resumeMarqueeSoon() {
      window.clearTimeout(marqueeResumeTimer);
      marqueeResumeTimer = window.setTimeout(function () {
        if (!reviewsViewport.matches(':focus-within') && !reviewsViewport.matches(':hover')) reviewsTrack.classList.remove('is-paused');
      }, 650);
    }

    reviewsViewport.addEventListener('pointerover', function (event) { if (event.target.closest('.review-card')) pauseMarquee(); });
    reviewsViewport.addEventListener('pointerout', function (event) {
      if (!event.relatedTarget || !event.relatedTarget.closest || !event.relatedTarget.closest('.review-card')) resumeMarqueeSoon();
    });
    reviewsViewport.addEventListener('focusin', pauseMarquee);
    reviewsViewport.addEventListener('focusout', resumeMarqueeSoon);
    reviewsViewport.addEventListener('pointerdown', pauseMarquee, { passive: true });
    reviewsViewport.addEventListener('pointerup', resumeMarqueeSoon, { passive: true });
    reviewsViewport.addEventListener('pointercancel', resumeMarqueeSoon, { passive: true });
    window.addEventListener('resize', requestReviewLayout, { passive: true });
    window.addEventListener('orientationchange', requestReviewLayout, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(requestReviewLayout).observe(reviewsViewport);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestReviewLayout);

    function setReviewError(id, message) {
      var error = document.getElementById(id);
      if (error) error.textContent = message;
    }

    function clearReviewErrors() {
      ['review-name-error', 'review-text-error', 'review-rating-error', 'review-photo-error'].forEach(function (id) { setReviewError(id, ''); });
      reviewStatus.textContent = '';
      reviewStatus.classList.remove('is-error');
    }

    function updateCharacterCount() {
      var remaining = 500 - reviewText.value.length;
      reviewCharacterCount.textContent = remaining + (remaining === 1 ? ' character remaining' : ' characters remaining');
    }

    function selectedRating() {
      var selected = reviewForm.querySelector('input[name="reviewRating"]:checked');
      return selected ? Number(selected.value) : 0;
    }

    function updateRatingVisuals(previewValue) {
      var value = previewValue || selectedRating();
      ratingLabels.forEach(function (label, index) { label.classList.toggle('is-selected', index < value); });
    }

    ratingInputs.forEach(function (input) { input.addEventListener('change', function () { updateRatingVisuals(); setReviewError('review-rating-error', ''); }); });
    ratingLabels.forEach(function (label, index) {
      label.addEventListener('pointerenter', function () { updateRatingVisuals(index + 1); });
    });
    document.querySelector('.review-rating-options').addEventListener('pointerleave', function () { updateRatingVisuals(); });
    reviewText.addEventListener('input', updateCharacterCount);

    function revokeReviewPhotoUrl() {
      if (reviewPhotoObjectUrl) URL.revokeObjectURL(reviewPhotoObjectUrl);
      reviewPhotoObjectUrl = '';
    }

    function clearSelectedPhoto() {
      revokeReviewPhotoUrl();
      reviewPhotoBlob = null;
      reviewPhoto.value = '';
      reviewPhotoPreview.hidden = true;
      reviewPhotoPreviewImage.removeAttribute('src');
      reviewPhotoPreviewName.textContent = '';
      setReviewError('review-photo-error', '');
    }

    function resizeReviewPhoto(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error('The selected image could not be read.')); };
        reader.onload = function () {
          var image = new Image();
          image.onerror = function () { reject(new Error('The selected file is not a valid image.')); };
          image.onload = function () {
            var scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            var context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function (blob) {
              if (blob) resolve(blob);
              else reject(new Error('The selected image could not be processed.'));
            }, file.type, file.type === 'image/png' ? undefined : .88);
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    reviewPhoto.addEventListener('change', function () {
      var file = reviewPhoto.files && reviewPhoto.files[0];
      if (!file) return;
      var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowedTypes.indexOf(file.type) === -1) {
        clearSelectedPhoto();
        setReviewError('review-photo-error', 'Choose a JPG, PNG or WebP image.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        clearSelectedPhoto();
        setReviewError('review-photo-error', 'The original image must be 5MB or smaller.');
        return;
      }
      photoProcessing = true;
      setReviewError('review-photo-error', 'Processing image…');
      resizeReviewPhoto(file).then(function (blob) {
        revokeReviewPhotoUrl();
        reviewPhotoBlob = blob;
        reviewPhotoObjectUrl = URL.createObjectURL(blob);
        reviewPhotoPreviewImage.src = reviewPhotoObjectUrl;
        reviewPhotoPreviewName.textContent = file.name;
        reviewPhotoPreview.hidden = false;
        setReviewError('review-photo-error', '');
      }).catch(function (error) {
        clearSelectedPhoto();
        setReviewError('review-photo-error', error.message);
      }).finally(function () { photoProcessing = false; });
    });
    reviewPhotoChange.addEventListener('click', function () { reviewPhoto.click(); });
    reviewPhotoRemove.addEventListener('click', clearSelectedPhoto);

    function lockReviewPage() {
      reviewPageScrollY = window.scrollY;
      document.body.style.top = '-' + reviewPageScrollY + 'px';
      document.body.classList.add('review-modal-open');
    }

    function unlockReviewPage() {
      document.body.classList.remove('review-modal-open');
      document.body.style.removeProperty('top');
      window.scrollTo(0, reviewPageScrollY);
    }

    function openReviewModal() {
      reviewLastFocused = document.activeElement;
      clearReviewErrors();
      reviewModalOverlay.hidden = false;
      lockReviewPage();
      reviewFormBody.scrollTop = 0;
      requestAnimationFrame(function () {
        reviewModalOverlay.classList.add('is-open');
        reviewName.focus();
      });
    }

    function closeReviewModal() {
      if (submittingReview) return;
      reviewModalOverlay.classList.remove('is-open');
      window.setTimeout(function () {
        reviewModalOverlay.hidden = true;
        unlockReviewPage();
        if (reviewLastFocused) reviewLastFocused.focus();
      }, isReduced ? 0 : 260);
    }

    function resetReviewForm() {
      reviewForm.reset();
      clearSelectedPhoto();
      clearReviewErrors();
      updateCharacterCount();
      updateRatingVisuals();
    }

    function showReviewToast(message) {
      window.clearTimeout(reviewToastTimer);
      reviewToast.textContent = message;
      reviewToast.classList.add('is-visible');
      reviewToastTimer = window.setTimeout(function () { reviewToast.classList.remove('is-visible'); }, 3600);
    }

    function setReviewSubmitting(isSubmitting) {
      submittingReview = isSubmitting;
      reviewSubmit.disabled = isSubmitting;
      reviewCancel.disabled = isSubmitting;
      reviewModalClose.disabled = isSubmitting;
      reviewSubmit.classList.toggle('is-submitting', isSubmitting);
      reviewSubmitLabel.textContent = isSubmitting ? 'Submitting…' : 'Submit Review';
    }

    function validateReview() {
      clearReviewErrors();
      var name = normalizeCustomerText(reviewName.value);
      var text = normalizeCustomerText(reviewText.value);
      var rating = selectedRating();
      var valid = true;
      if (name.length < 2 || name.length > 80) { setReviewError('review-name-error', 'Enter a name between 2 and 80 characters.'); valid = false; }
      if (text.length < 20 || text.length > 500) { setReviewError('review-text-error', 'Enter a review between 20 and 500 characters.'); valid = false; }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) { setReviewError('review-rating-error', 'Select a rating from 1 to 5 stars.'); valid = false; }
      if (photoProcessing) { setReviewError('review-photo-error', 'Please wait while your image is processed.'); valid = false; }
      if (!valid) reviewStatus.textContent = 'Please correct the highlighted review fields.';
      return valid ? { customerName: name, reviewText: text, rating: rating } : null;
    }

    function createStorageFilename(blob) {
      var extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      var uniqueId = window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
      return 'public/' + uniqueId + '.' + extension;
    }

    function uploadReviewPhoto(blob) {
      if (!blob) return Promise.resolve(null);
      var storagePath = createStorageFilename(blob);
      var endpoint = SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/review-photos/' + storagePath;
      return fetch(endpoint, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': blob.type, 'x-upsert': 'false' }),
        body: blob
      }).then(function (response) {
        if (!response.ok) throw new Error('Your photo could not be uploaded. Please try again.');
        return SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/review-photos/' + storagePath;
      });
    }

    function insertReview(review, photoUrl) {
      var endpoint = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/customer_reviews';
      var payload = {
        customer_name: review.customerName,
        review_text: review.reviewText,
        rating: review.rating,
        photo_url: photoUrl,
        status: REVIEW_AUTO_PUBLISH ? 'approved' : 'pending'
      };
      return fetch(endpoint, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: REVIEW_AUTO_PUBLISH ? 'return=representation' : 'return=minimal' }),
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (!response.ok) return response.json().catch(function () { return {}; }).then(function (details) { throw new Error(details.message || 'Your review could not be saved. Please try again.'); });
        if (!REVIEW_AUTO_PUBLISH) return {
          id: 'pending-' + Date.now(),
          customerName: review.customerName,
          reviewText: review.reviewText,
          rating: review.rating,
          photoUrl: photoUrl || '',
          createdAt: new Date().toISOString()
        };
        return response.json();
      }).then(function (records) {
        if (!REVIEW_AUTO_PUBLISH) return records;
        if (!records || !records[0]) throw new Error('Your review was received but no saved record was returned.');
        return mapDatabaseReview(records[0]);
      });
    }

    reviewForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submittingReview) return;
      if (document.getElementById('review-website').value) {
        reviewStatus.textContent = 'The review could not be submitted.';
        reviewStatus.classList.add('is-error');
        return;
      }
      var review = validateReview();
      if (!review) return;
      if (!isSupabaseConfigured()) {
        reviewStatus.textContent = 'Online review storage has not been connected yet. Your review was not published. Add the Supabase URL and publishable key in script.js to enable submissions.';
        reviewStatus.classList.add('is-error');
        return;
      }
      if (Date.now() - lastReviewSubmission < 8000) {
        reviewStatus.textContent = 'Please wait a few seconds before submitting again.';
        reviewStatus.classList.add('is-error');
        return;
      }
      lastReviewSubmission = Date.now();
      setReviewSubmitting(true);
      reviewStatus.textContent = 'Securely saving your review…';
      uploadReviewPhoto(reviewPhotoBlob).then(function (photoUrl) {
        return insertReview(review, photoUrl);
      }).then(function (savedReview) {
        if (REVIEW_AUTO_PUBLISH) {
          reviews.unshift(savedReview);
          renderReviews(savedReview.id);
          showReviewToast('Thank you! Your review has been added.');
        } else showReviewToast('Thank you! Your review is awaiting approval.');
        setReviewSubmitting(false);
        reviewModalOverlay.classList.remove('is-open');
        window.setTimeout(function () {
          reviewModalOverlay.hidden = true;
          unlockReviewPage();
          resetReviewForm();
          addReviewButton.focus();
        }, isReduced ? 0 : 260);
      }).catch(function (error) {
        setReviewSubmitting(false);
        reviewStatus.textContent = error.message || 'Your review could not be saved. Please try again.';
        reviewStatus.classList.add('is-error');
      });
    });

    addReviewButton.addEventListener('click', openReviewModal);
    reviewModalClose.addEventListener('click', closeReviewModal);
    reviewCancel.addEventListener('click', closeReviewModal);
    reviewModalOverlay.addEventListener('click', function (event) { if (event.target === reviewModalOverlay) closeReviewModal(); });
    document.addEventListener('keydown', function (event) {
      if (reviewModalOverlay.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeReviewModal();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusable = Array.prototype.slice.call(reviewModalOverlay.querySelectorAll('button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(function (element) { return !element.hidden && element.offsetParent !== null; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    renderReviews();
    updateCharacterCount();
    loadApprovedReviews();
  }

  initializeCustomerReviews();

  var form = document.getElementById('contact-form');
  var formStatus = document.getElementById('form-status');

  function setError(id, message) {
    var field = document.getElementById(id);
    var error = document.getElementById('err-' + id);
    if (error) error.textContent = message || '';
    if (field && field.closest('.form-row')) field.closest('.form-row').classList.toggle('is-invalid', Boolean(message));
    if (field) field.setAttribute('aria-invalid', String(Boolean(message)));
  }

  if (form) {
    form.addEventListener('input', function (event) {
      if (event.target.id) setError(event.target.id, '');
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      formStatus.textContent = '';
      var values = {
        fullName: document.getElementById('fullName'), businessName: document.getElementById('businessName'),
        phone: document.getElementById('phone'), email: document.getElementById('email'),
        service: document.getElementById('service'), budget: document.getElementById('budget'),
        deadline: document.getElementById('deadline'), description: document.getElementById('description'),
        consent: document.getElementById('consent')
      };
      Object.keys(values).forEach(function (id) { setError(id, ''); });
      var errors = [];
      if (!values.fullName.value.trim()) errors.push(['fullName', 'Please enter your full name.']);
      if (!values.businessName.value.trim()) errors.push(['businessName', 'Please enter your business name.']);
      if (!/^[0-9+\-\s()]{7,}$/.test(values.phone.value.trim())) errors.push(['phone', 'Please enter a valid phone number.']);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.value.trim())) errors.push(['email', 'Please enter a valid email address.']);
      if (!values.service.value) errors.push(['service', 'Please select a required service.']);
      if (!values.budget.value) errors.push(['budget', 'Please select an estimated budget.']);
      if (!values.description.value.trim()) errors.push(['description', 'Please describe your project.']);
      if (!values.consent.checked) errors.push(['consent', 'Please confirm you agree to be contacted.']);
      errors.forEach(function (error) { setError(error[0], error[1]); });
      if (errors.length) {
        formStatus.style.color = 'var(--danger)';
        formStatus.textContent = 'Please fix the highlighted fields above.';
        values[errors[0][0]].focus();
        return;
      }
      var lines = [
        'Hi Zyntra Studio! I’d like to start a project.',
        'Name: ' + values.fullName.value.trim(), 'Business: ' + values.businessName.value.trim(),
        'Phone: ' + values.phone.value.trim(), 'Email: ' + values.email.value.trim(),
        'Service: ' + values.service.value, 'Budget: ' + values.budget.value,
        'Deadline: ' + (values.deadline.value.trim() || 'Not specified'),
        'Project details: ' + values.description.value.trim()
      ];
      formStatus.style.color = 'var(--success)';
      formStatus.textContent = 'WhatsApp will open with your project details. Please review the message and tap Send.';
      window.open('https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    });
  }

  var hero = document.getElementById('home');
  if (hero && !isTouch && !isReduced) {
    hero.addEventListener('pointermove', function (event) {
      var rect = hero.getBoundingClientRect();
      hero.style.setProperty('--glow-x', (event.clientX - rect.left - rect.width / 2) * 0.09 + 'px');
      hero.style.setProperty('--glow-y', (event.clientY - rect.top - rect.height / 2) * 0.09 + 'px');
    }, { passive: true });

    document.querySelectorAll('.btn').forEach(function (button) {
      button.addEventListener('pointermove', function (event) {
        var rect = button.getBoundingClientRect();
        button.style.setProperty('--mx', (event.clientX - rect.left - rect.width / 2) * 0.09 + 'px');
        button.style.setProperty('--my', (event.clientY - rect.top - rect.height / 2) * 0.13 + 'px');
      });
      button.addEventListener('pointerleave', function () {
        button.style.setProperty('--mx', '0px'); button.style.setProperty('--my', '0px');
      });
    });
  }

  function createSparkBurst(x, y) {
    if (isReduced || document.hidden) return;
    var core = document.createElement('span');
    core.className = 'spark-burst'; core.style.left = x + 'px'; core.style.top = y + 'px';
    document.body.appendChild(core);
    var colors = ['#54d8ff', '#4d7cff', '#806dff', '#ffffff'];
    var count = isTouch ? 6 : 8;
    for (var i = 0; i < count; i += 1) {
      var particle = document.createElement('span');
      var angle = (Math.PI * 2 * i / count) + Math.random() * 0.35;
      var distance = 20 + Math.random() * 34;
      particle.className = 'spark-particle';
      particle.style.left = x + 'px'; particle.style.top = y + 'px';
      particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
      particle.style.setProperty('--dy', (Math.sin(angle) * distance + 45 + Math.random() * 38) + 'px');
      particle.style.setProperty('--spin', (Math.random() * 260 - 130) + 'deg');
      particle.style.setProperty('--size', (2 + Math.random() * 3) + 'px');
      particle.style.setProperty('--duration', (620 + Math.random() * 240) + 'ms');
      particle.style.setProperty('--spark', colors[i % colors.length]);
      document.body.appendChild(particle);
      window.setTimeout(function (node) { node.remove(); }, 920, particle);
    }
    window.setTimeout(function () { core.remove(); }, 740);
  }

  document.addEventListener('pointerup', function (event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('input, textarea, select, option, label, [contenteditable="true"]')) return;
    var selection = window.getSelection();
    if (selection && selection.toString()) return;
    createSparkBurst(event.clientX, event.clientY);
  }, { passive: true });

  initStarField();

  function initStarField() {
    var canvas = document.getElementById('star-canvas');
    var context = canvas.getContext('2d', { alpha: true });
    var stars = [];
    var width = 0, height = 0, dpr = 1, animationFrame = 0, lastTime = 0, scrollOffset = 0;
    var paused = document.hidden;
    var colors = ['116,153,255', '84,216,255', '255,255,255', '128,109,255'];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = isTouch || width < 700 ? Math.min(38, Math.round(width / 12)) : Math.min(92, Math.round(width / 16));
      stars = [];
      for (var i = 0; i < count; i += 1) {
        var leftSide = Math.random() < .5;
        var edgeWidth = width < 700 ? width * .2 : Math.min(width * .22, 300);
        stars.push({
          x: leftSide ? Math.random() * edgeWidth : width - Math.random() * edgeWidth,
          y: Math.random() * height, radius: .35 + Math.random() * 1.3,
          alpha: .08 + Math.random() * .42, phase: Math.random() * Math.PI * 2,
          speed: .012 + Math.random() * .026, depth: .25 + Math.random() * .75,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      draw(0);
    }

    function draw(time) {
      if (paused) return;
      var delta = Math.min(32, time - lastTime || 16); lastTime = time;
      context.clearRect(0, 0, width, height);
      for (var i = 0; i < stars.length; i += 1) {
        var star = stars[i];
        if (!isReduced) {
          star.y += star.speed * delta * star.depth;
          star.phase += .0009 * delta;
          if (star.y > height + 4) star.y = -4;
        }
        var y = (star.y + scrollOffset * star.depth * .025) % (height + 8);
        var twinkle = isReduced ? star.alpha : star.alpha * (.68 + Math.sin(star.phase) * .28);
        context.beginPath(); context.arc(star.x, y, star.radius, 0, Math.PI * 2);
        context.fillStyle = 'rgba(' + star.color + ',' + Math.max(.02, twinkle) + ')'; context.fill();
        if (star.radius > 1.15) {
          context.beginPath(); context.arc(star.x, y, star.radius * 4, 0, Math.PI * 2);
          context.fillStyle = 'rgba(' + star.color + ',' + twinkle * .08 + ')'; context.fill();
        }
      }
      if (!isReduced) animationFrame = requestAnimationFrame(draw);
    }

    resize();
    if (!isReduced) animationFrame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', function () { scrollOffset = window.scrollY; }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      paused = document.hidden;
      if (paused) cancelAnimationFrame(animationFrame);
      else if (!isReduced) { lastTime = performance.now(); animationFrame = requestAnimationFrame(draw); }
    });
  }
});
