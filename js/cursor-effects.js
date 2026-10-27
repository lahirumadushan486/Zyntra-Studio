(function () {
  'use strict';

  // Central configuration for the hero-only Digital Magic pointer effect.
  var CURSOR_EFFECT_CONFIG = Object.freeze({
    enabled: true,
    glowColour: '#54d8ff',
    particleColours: Object.freeze(['#54d8ff', '#4d7cff', '#806dff']),
    particleCountLimit: 34,
    particleLifetime: 430,
    glowSize: 38,
    hoverIntensity: 1.28,
    clickRippleEnabled: true
  });

  if (window.ZyntraCursorEffects) return;

  var api = {
    config: CURSOR_EFFECT_CONFIG,
    destroy: function () {},
    getState: function () { return { enabled: false, running: false, particles: 0, ripples: 0, pointerInside: false, heroVisible: false }; }
  };
  window.ZyntraCursorEffects = api;

  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  var hero = document.getElementById('home');
  if (!CURSOR_EFFECT_CONFIG.enabled || reducedMotionQuery.matches || !finePointerQuery.matches || !hero || document.body.getAttribute('data-page') !== 'home') return;
  if (hero.querySelector('[data-zyntra-cursor-effects]')) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'zyntra-cursor-effects';
  canvas.dataset.zyntraCursorEffects = '';
  canvas.setAttribute('aria-hidden', 'true');
  hero.appendChild(canvas);

  var context = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!context) {
    canvas.remove();
    return;
  }

  var width = 0;
  var height = 0;
  var dpr = 1;
  var frameId = 0;
  var running = false;
  var destroyed = false;
  var heroVisible = true;
  var pointerInside = false;
  var hoveredControl = false;
  var lastFrameTime = 0;
  var lastEmitTime = 0;
  var lastEmitX = 0;
  var lastEmitY = 0;
  var targetX = 0;
  var targetY = 0;
  var glowX = 0;
  var glowY = 0;
  var glowAlpha = 0;
  var glowIntensity = 1;
  var particles = [];
  var ripples = [];
  var listenerCleanups = [];
  var resizeObserver = null;
  var intersectionObserver = null;
  var removalObserver = null;
  var glowRgb = toRgb(CURSOR_EFFECT_CONFIG.glowColour);
  var particleRgb = CURSOR_EFFECT_CONFIG.particleColours.map(toRgb);

  for (var particleIndex = 0; particleIndex < CURSOR_EFFECT_CONFIG.particleCountLimit; particleIndex += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, born: 0, life: 0, size: 0, colour: particleRgb[0], sparkle: false });
  }

  function toRgb(colour) {
    var value = String(colour || '').replace('#', '');
    if (value.length === 3) value = value.split('').map(function (part) { return part + part; }).join('');
    var number = /^[0-9a-f]{6}$/i.test(value) ? parseInt(value, 16) : 0x54d8ff;
    return { r: number >> 16 & 255, g: number >> 8 & 255, b: number & 255 };
  }

  function rgba(colour, alpha) {
    return 'rgba(' + colour.r + ',' + colour.g + ',' + colour.b + ',' + alpha + ')';
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listenerCleanups.push(function () { target.removeEventListener(type, handler, options); });
  }

  function resize() {
    if (destroyed || !hero.isConnected) return;
    width = Math.max(1, hero.clientWidth);
    height = Math.max(1, hero.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (pointerInside) startLoop();
  }

  function pointerPosition(event) {
    var bounds = hero.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function updateHover(target) {
    var interactive = target && target.closest ? target.closest('a, button') : null;
    hoveredControl = Boolean(interactive && hero.contains(interactive));
  }

  function acquireParticle() {
    for (var i = 0; i < particles.length; i += 1) {
      if (!particles[i].active) return particles[i];
    }
    return null;
  }

  function spawnParticle(x, y, time) {
    var particle = acquireParticle();
    if (!particle) return;
    var angle = Math.random() * Math.PI * 2;
    var speed = 0.012 + Math.random() * 0.028;
    particle.active = true;
    particle.x = x + (Math.random() - 0.5) * 5;
    particle.y = y + (Math.random() - 0.5) * 5;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed - 0.008;
    particle.born = time;
    particle.life = CURSOR_EFFECT_CONFIG.particleLifetime * (0.72 + Math.random() * 0.48);
    particle.size = 0.75 + Math.random() * 1.35;
    particle.colour = particleRgb[Math.random() < 0.14 ? 2 : (Math.random() < 0.55 ? 0 : 1)];
    particle.sparkle = Math.random() < 0.13;
  }

  function emitTrail(x, y, time) {
    var distance = Math.hypot(x - lastEmitX, y - lastEmitY);
    if (time - lastEmitTime < 24 || distance < 7) return;
    spawnParticle(x, y, time);
    if (distance > 22 && Math.random() < 0.35) spawnParticle(x - (x - lastEmitX) * 0.35, y - (y - lastEmitY) * 0.35, time);
    lastEmitX = x;
    lastEmitY = y;
    lastEmitTime = time;
  }

  function startLoop() {
    if (running || destroyed || document.hidden || !heroVisible) return;
    running = true;
    lastFrameTime = performance.now();
    frameId = window.requestAnimationFrame(render);
  }

  function clearAndStop() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    running = false;
    context.clearRect(0, 0, width, height);
  }

  function render(time) {
    if (destroyed || document.hidden || !heroVisible) {
      clearAndStop();
      return;
    }

    var delta = Math.min(34, Math.max(0, time - lastFrameTime || 16));
    lastFrameTime = time;
    var positionEase = 1 - Math.exp(-delta * 0.018);
    var fadeEase = 1 - Math.exp(-delta * 0.014);
    var desiredAlpha = pointerInside ? 1 : 0;
    var desiredIntensity = hoveredControl ? CURSOR_EFFECT_CONFIG.hoverIntensity : 1;
    glowX += (targetX - glowX) * positionEase;
    glowY += (targetY - glowY) * positionEase;
    glowAlpha += (desiredAlpha - glowAlpha) * fadeEase;
    glowIntensity += (desiredIntensity - glowIntensity) * fadeEase;

    context.clearRect(0, 0, width, height);
    if (glowAlpha > 0.006) drawGlow();

    var activeParticleCount = 0;
    for (var i = 0; i < particles.length; i += 1) {
      var particle = particles[i];
      if (!particle.active) continue;
      var age = time - particle.born;
      if (age >= particle.life) {
        particle.active = false;
        continue;
      }
      activeParticleCount += 1;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      drawParticle(particle, age / particle.life);
    }

    for (var rippleIndex = ripples.length - 1; rippleIndex >= 0; rippleIndex -= 1) {
      var ripple = ripples[rippleIndex];
      var rippleProgress = (time - ripple.born) / ripple.life;
      if (rippleProgress >= 1) {
        ripples.splice(rippleIndex, 1);
      } else {
        drawRipple(ripple, rippleProgress);
      }
    }

    var hasVisibleEffect = glowAlpha > 0.008 || activeParticleCount > 0 || ripples.length > 0;
    if (hasVisibleEffect) frameId = window.requestAnimationFrame(render);
    else clearAndStop();
  }

  function drawGlow() {
    var radius = CURSOR_EFFECT_CONFIG.glowSize * glowIntensity;
    var gradient = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, radius);
    gradient.addColorStop(0, rgba(glowRgb, 0.19 * glowAlpha * glowIntensity));
    gradient.addColorStop(0.34, rgba(glowRgb, 0.09 * glowAlpha));
    gradient.addColorStop(1, rgba(glowRgb, 0));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(glowX, glowY, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawParticle(particle, progress) {
    var remaining = 1 - progress;
    var alpha = remaining * remaining * 0.7;
    var size = Math.max(0.15, particle.size * remaining);
    context.fillStyle = rgba(particle.colour, alpha);
    context.beginPath();
    context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
    context.fill();
    if (!particle.sparkle) return;
    context.strokeStyle = rgba(particle.colour, alpha * 0.55);
    context.lineWidth = 0.55;
    context.beginPath();
    context.moveTo(particle.x - size * 2.2, particle.y);
    context.lineTo(particle.x + size * 2.2, particle.y);
    context.moveTo(particle.x, particle.y - size * 2.2);
    context.lineTo(particle.x, particle.y + size * 2.2);
    context.stroke();
  }

  function drawRipple(ripple, progress) {
    var eased = 1 - Math.pow(1 - progress, 2);
    var radius = 4 + eased * 22;
    context.strokeStyle = rgba(glowRgb, (1 - progress) * 0.28);
    context.lineWidth = Math.max(0.5, 1.1 * (1 - progress));
    context.beginPath();
    context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    context.stroke();
  }

  function onPointerEnter(event) {
    var position = pointerPosition(event);
    pointerInside = true;
    targetX = position.x;
    targetY = position.y;
    if (glowAlpha < 0.01) {
      glowX = targetX;
      glowY = targetY;
    }
    lastEmitX = targetX;
    lastEmitY = targetY;
    lastEmitTime = performance.now();
    updateHover(event.target);
    startLoop();
  }

  function onPointerMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    var position = pointerPosition(event);
    targetX = position.x;
    targetY = position.y;
    pointerInside = true;
    updateHover(event.target);
    emitTrail(targetX, targetY, performance.now());
    startLoop();
  }

  function hidePointer() {
    pointerInside = false;
    hoveredControl = false;
    startLoop();
  }

  function onPointerDown(event) {
    if (!CURSOR_EFFECT_CONFIG.clickRippleEnabled || event.button !== 0) return;
    var position = pointerPosition(event);
    ripples.push({ x: position.x, y: position.y, born: performance.now(), life: 340 });
    if (ripples.length > 3) ripples.shift();
    startLoop();
  }

  function onDocumentMouseOut(event) {
    if (!event.relatedTarget) hidePointer();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      running = false;
      return;
    }
    if (pointerInside && heroVisible) startLoop();
  }

  function activeParticleCount() {
    var count = 0;
    for (var i = 0; i < particles.length; i += 1) if (particles[i].active) count += 1;
    return count;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearAndStop();
    listenerCleanups.forEach(function (removeListener) { removeListener(); });
    listenerCleanups = [];
    if (resizeObserver) resizeObserver.disconnect();
    if (intersectionObserver) intersectionObserver.disconnect();
    if (removalObserver) removalObserver.disconnect();
    canvas.remove();
  }

  api.destroy = destroy;
  api.getState = function () {
    return {
      enabled: !destroyed,
      running: running,
      particles: activeParticleCount(),
      ripples: ripples.length,
      pointerInside: pointerInside,
      heroVisible: heroVisible,
      hoveredControl: hoveredControl
    };
  };

  listen(hero, 'pointerenter', onPointerEnter, { passive: true });
  listen(hero, 'pointermove', onPointerMove, { passive: true });
  listen(hero, 'pointerleave', hidePointer, { passive: true });
  listen(hero, 'pointerdown', onPointerDown, { passive: true });
  listen(hero, 'pointerover', function (event) { updateHover(event.target); startLoop(); }, { passive: true });
  listen(hero, 'pointerout', function (event) { updateHover(event.relatedTarget); startLoop(); }, { passive: true });
  listen(window, 'blur', hidePointer, { passive: true });
  listen(document, 'mouseout', onDocumentMouseOut, { passive: true });
  listen(document, 'visibilitychange', onVisibilityChange, { passive: true });
  listen(reducedMotionQuery, 'change', function (event) { if (event.matches) destroy(); });
  listen(finePointerQuery, 'change', function (event) { if (!event.matches) destroy(); });

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
  } else {
    listen(window, 'resize', resize, { passive: true });
  }

  if ('IntersectionObserver' in window) {
    intersectionObserver = new IntersectionObserver(function (entries) {
      heroVisible = Boolean(entries[0] && entries[0].isIntersecting);
      if (!heroVisible) {
        pointerInside = false;
        particles.forEach(function (particle) { particle.active = false; });
        ripples.length = 0;
        glowAlpha = 0;
        clearAndStop();
      }
    }, { threshold: 0 });
    intersectionObserver.observe(hero);
  }

  if (hero.parentNode && 'MutationObserver' in window) {
    removalObserver = new MutationObserver(function () { if (!hero.isConnected) destroy(); });
    removalObserver.observe(hero.parentNode, { childList: true });
  }

  resize();
}());
