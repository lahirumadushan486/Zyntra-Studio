(function configureZyntraCaptcha(global) {
  'use strict';

  const widgets = new Map();
  const tokens = new Map();

  function configured() {
    const key = global.ZyntraSupabase && global.ZyntraSupabase.TURNSTILE_SITE_KEY;
    return Boolean(key && !/^PASTE_/i.test(key));
  }

  function waitForTurnstile() {
    return new Promise(function (resolve, reject) {
      if (global.turnstile) { resolve(global.turnstile); return; }
      let attempts = 0;
      const timer = global.setInterval(function () {
        attempts += 1;
        if (global.turnstile) { global.clearInterval(timer); resolve(global.turnstile); }
        else if (attempts >= 50) { global.clearInterval(timer); reject(new Error('The security check could not be loaded.')); }
      }, 200);
    });
  }

  async function render(containerId) {
    if (widgets.has(containerId)) return widgets.get(containerId);
    if (!configured()) throw new Error('The security check is not configured.');
    const container = document.getElementById(containerId);
    if (!container) throw new Error('The security check container is missing.');
    const turnstile = await waitForTurnstile();
    const widgetId = turnstile.render(container, {
      sitekey: global.ZyntraSupabase.TURNSTILE_SITE_KEY,
      theme: 'dark',
      size: 'flexible',
      callback: function (token) { tokens.set(containerId, token); },
      'expired-callback': function () { tokens.delete(containerId); },
      'error-callback': function () { tokens.delete(containerId); }
    });
    widgets.set(containerId, widgetId);
    return widgetId;
  }

  function token(containerId) { return tokens.get(containerId) || ''; }
  function reset(containerId) {
    tokens.delete(containerId);
    if (global.turnstile && widgets.has(containerId)) global.turnstile.reset(widgets.get(containerId));
  }

  global.ZyntraCaptcha = Object.freeze({ configured: configured, render: render, token: token, reset: reset });
}(window));
