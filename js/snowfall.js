(function () {
  'use strict';

  var SNOWFALL_CONFIG = Object.freeze({
    enabled: true,
    desktopParticleLimit: 68,
    mobileParticleLimit: 30,
    minimumSize: 0.55,
    maximumSize: 2.35,
    fallSpeed: Object.freeze({ minimum: 9, maximum: 23 }),
    opacity: Object.freeze({ minimum: 0.12, maximum: 0.42 }),
    colours: Object.freeze(['255,255,255', '220,239,255', '174,220,255']),
    excludedRoutes: Object.freeze([
      '/admin', '/portal', '/client', 'admin-', 'client-', 'portal-access',
      'quotation', 'quotation-image', 'invoice', '/export', '.pdf'
    ])
  });

  if (window.ZyntraSnowfall) {
    window.ZyntraSnowfall.start();
    return;
  }

  var canvas = null;
  var context = null;
  var particles = [];
  var frameId = 0;
  var resizeFrameId = 0;
  var lastTime = 0;
  var width = 0;
  var height = 0;
  var pixelRatio = 1;
  var running = false;
  var listeners = [];
  var removalObserver = null;
  var motionListenerAttached = false;
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobileQuery = window.matchMedia('(max-width: 700px), (pointer: coarse)');

  function listen(target, type, handler, options) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, handler, options);
    listeners.push(function () { target.removeEventListener(type, handler, options); });
  }

  function routeIsExcluded() {
    var route = (window.location.pathname || '/').toLowerCase();
    return SNOWFALL_CONFIG.excludedRoutes.some(function (excludedRoute) {
      return route.indexOf(excludedRoute) !== -1;
    });
  }

  function randomBetween(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function createParticle(initial) {
    var size = randomBetween(SNOWFALL_CONFIG.minimumSize, SNOWFALL_CONFIG.maximumSize);
    var isFlake = Math.random() < (mobileQuery.matches ? 0.06 : 0.1);
    return {
      x: Math.random() * width,
      y: initial ? Math.random() * height : -8,
      size: size,
      speed: randomBetween(SNOWFALL_CONFIG.fallSpeed.minimum, SNOWFALL_CONFIG.fallSpeed.maximum),
      drift: randomBetween(-4.2, 4.2),
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: randomBetween(0.45, 1.05),
      opacity: randomBetween(SNOWFALL_CONFIG.opacity.minimum, SNOWFALL_CONFIG.opacity.maximum),
      colour: SNOWFALL_CONFIG.colours[Math.floor(Math.random() * SNOWFALL_CONFIG.colours.length)],
      isFlake: isFlake,
      rotation: Math.random() * Math.PI,
      rotationSpeed: randomBetween(-0.18, 0.18)
    };
  }

  function particleLimit() {
    return mobileQuery.matches ? SNOWFALL_CONFIG.mobileParticleLimit : SNOWFALL_CONFIG.desktopParticleLimit;
  }

  function resetParticles() {
    var limit = particleLimit();
    particles = [];
    for (var index = 0; index < limit; index += 1) particles.push(createParticle(true));
  }

  function resize() {
    if (!canvas || !context) return;
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    resetParticles();
    if (!running) drawFrame(0, false);
  }

  function scheduleResize() {
    if (resizeFrameId) return;
    resizeFrameId = window.requestAnimationFrame(function () {
      resizeFrameId = 0;
      resize();
    });
  }

  function drawSixBranchFlake(particle) {
    var radius = Math.min(5.2, particle.size * 1.85 + 1.1);
    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.beginPath();
    for (var branch = 0; branch < 6; branch += 1) {
      var angle = branch * Math.PI / 3;
      var x = Math.cos(angle) * radius;
      var y = Math.sin(angle) * radius;
      context.moveTo(0, 0);
      context.lineTo(x, y);
      var twigStart = radius * 0.58;
      var twigLength = radius * 0.24;
      var startX = Math.cos(angle) * twigStart;
      var startY = Math.sin(angle) * twigStart;
      context.moveTo(startX, startY);
      context.lineTo(startX + Math.cos(angle + 0.72) * twigLength, startY + Math.sin(angle + 0.72) * twigLength);
      context.moveTo(startX, startY);
      context.lineTo(startX + Math.cos(angle - 0.72) * twigLength, startY + Math.sin(angle - 0.72) * twigLength);
    }
    context.strokeStyle = 'rgba(' + particle.colour + ',' + particle.opacity + ')';
    context.lineWidth = 0.65;
    context.lineCap = 'round';
    context.stroke();
    context.restore();
  }

  function drawParticle(particle) {
    if (particle.isFlake) {
      drawSixBranchFlake(particle);
      return;
    }
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fillStyle = 'rgba(' + particle.colour + ',' + particle.opacity + ')';
    context.fill();
  }

  function drawFrame(time, animate) {
    if (!canvas || !context) return;
    if (!canvas.isConnected) {
      destroy();
      return;
    }
    var deltaSeconds = Math.min(0.05, Math.max(0, (time - lastTime) / 1000 || 0));
    lastTime = time;
    context.clearRect(0, 0, width, height);
    for (var index = 0; index < particles.length; index += 1) {
      var particle = particles[index];
      if (animate) {
        particle.phase += particle.phaseSpeed * deltaSeconds;
        particle.y += particle.speed * deltaSeconds;
        particle.x += (particle.drift + Math.sin(particle.phase) * 2.1) * deltaSeconds;
        particle.rotation += particle.rotationSpeed * deltaSeconds;
        if (particle.y > height + 9) particles[index] = particle = createParticle(false);
        if (particle.x < -10) particle.x = width + 8;
        else if (particle.x > width + 10) particle.x = -8;
      }
      drawParticle(particle);
    }
  }

  function render(time) {
    frameId = 0;
    if (!running || document.hidden || reducedMotionQuery.matches) return;
    drawFrame(time, true);
    frameId = window.requestAnimationFrame(render);
  }

  function resume() {
    if (!running || document.hidden || reducedMotionQuery.matches || frameId) return;
    lastTime = performance.now();
    frameId = window.requestAnimationFrame(render);
  }

  function pause() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = 0;
  }

  function handleVisibilityChange() {
    if (document.hidden) pause();
    else resume();
  }

  function handleMotionChange() {
    if (reducedMotionQuery.matches) {
      destroy();
      attachMotionListener();
    }
    else start();
  }

  function attachMotionListener() {
    if (motionListenerAttached || !SNOWFALL_CONFIG.enabled) return;
    reducedMotionQuery.addEventListener('change', handleMotionChange);
    motionListenerAttached = true;
  }

  function detachMotionListener() {
    if (!motionListenerAttached) return;
    reducedMotionQuery.removeEventListener('change', handleMotionChange);
    motionListenerAttached = false;
  }

  function destroy() {
    pause();
    if (resizeFrameId) window.cancelAnimationFrame(resizeFrameId);
    resizeFrameId = 0;
    while (listeners.length) listeners.pop()();
    detachMotionListener();
    if (removalObserver) removalObserver.disconnect();
    removalObserver = null;
    if (canvas) canvas.remove();
    canvas = null;
    context = null;
    particles = [];
    running = false;
  }

  function start() {
    attachMotionListener();
    if (running || !SNOWFALL_CONFIG.enabled || reducedMotionQuery.matches || routeIsExcluded() || !document.body) return false;
    try {
      var existingCanvas = document.querySelector('.zyntra-snowfall');
      if (existingCanvas) existingCanvas.remove();
      canvas = document.createElement('canvas');
      canvas.className = 'zyntra-snowfall';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('data-html2canvas-ignore', 'true');
      canvas.setAttribute('data-export-ignore', 'true');
      context = canvas.getContext('2d', { alpha: true, desynchronized: true });
      if (!context) {
        canvas.remove();
        canvas = null;
        return false;
      }
      document.body.insertBefore(canvas, document.body.firstChild);
      running = true;
      resize();
      listen(window, 'resize', scheduleResize, { passive: true });
      listen(window, 'orientationchange', scheduleResize, { passive: true });
      listen(document, 'visibilitychange', handleVisibilityChange);
      listen(window, 'pageshow', resume);
      listen(window, 'pagehide', pause);
      listen(mobileQuery, 'change', scheduleResize);
      if (window.MutationObserver) {
        removalObserver = new MutationObserver(function () {
          if (canvas && !canvas.isConnected) destroy();
        });
        removalObserver.observe(document.body, { childList: true });
      }
      resume();
      return true;
    } catch (error) {
      destroy();
      return false;
    }
  }

  window.ZyntraSnowfall = {
    config: SNOWFALL_CONFIG,
    start: start,
    destroy: destroy,
    getState: function () {
      return { enabled: running, particleCount: particles.length, frameScheduled: Boolean(frameId), canvasConnected: Boolean(canvas && canvas.isConnected) };
    }
  };

  attachMotionListener();
  if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', start, { once: true });
  else start();
}());
