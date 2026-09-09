/* Zyntra Studio — interactions, accessibility and ambient effects */
// Central brand logo configuration — replace only this value when the final logo URL is ready.
const BRAND_LOGO_URL = "PASTE_ZYNTRA_STUDIO_LOGO_IMAGE_URL_HERE";

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
