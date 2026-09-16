(function configurePortalSessionTimeout(global) {
  'use strict';

  const PORTAL_SESSION_DURATION_MS = 15 * 60 * 1000;
  const WARNING_BEFORE_MS = 60 * 1000;
  const EXPIRY_KEY = 'zyntra_portal_expires_at';
  const EVENT_KEY = 'zyntra_portal_session_event';
  const CHANNEL_NAME = 'zyntra_portal_session';
  let supabase = null;
  let role = 'client';
  let expiryTimer = 0;
  let warningTimer = 0;
  let logoutInProgress = false;
  let listenersInstalled = false;
  let channel = null;
  const cleanupCallbacks = new Set();

  function loginUrl(reason) {
    const page = role === 'admin' ? 'admin-login.html' : 'client-login.html';
    return reason === 'session_expired' ? page + '?reason=session_expired' : page;
  }

  function readExpiry() {
    const value = Number(global.localStorage.getItem(EXPIRY_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function removeWarning() {
    const warning = document.getElementById('portal-session-warning');
    if (warning) warning.remove();
  }

  function showWarning() {
    if (document.getElementById('portal-session-warning') || logoutInProgress) return;
    const warning = document.createElement('section');
    warning.id = 'portal-session-warning';
    warning.className = 'cp-session-warning';
    warning.setAttribute('role', 'alertdialog');
    warning.setAttribute('aria-modal', 'true');
    warning.setAttribute('aria-labelledby', 'portal-session-warning-title');
    const title = document.createElement('strong');
    title.id = 'portal-session-warning-title';
    title.textContent = 'Your secure session will expire in 1 minute.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cp-button cp-button--secondary';
    button.textContent = 'Logout now';
    button.addEventListener('click', function () { performPortalLogout({ reason: 'manual' }); }, { once: true });
    warning.append(title, button);
    document.body.appendChild(warning);
    button.focus();
  }

  function clearTimers() {
    global.clearTimeout(expiryTimer);
    global.clearTimeout(warningTimer);
    expiryTimer = 0;
    warningTimer = 0;
    removeWarning();
  }

  function clearPortalSessionTimeout(options) {
    clearTimers();
    global.localStorage.removeItem(EXPIRY_KEY);
    if (!options || options.broadcast !== false) broadcast('logout');
  }

  function broadcast(type) {
    const payload = { type: type, at: Date.now() };
    try { if (channel) channel.postMessage(payload); } catch (_error) {}
    try { global.localStorage.setItem(EVENT_KEY, JSON.stringify(payload)); global.localStorage.removeItem(EVENT_KEY); } catch (_error) {}
  }

  function runCleanup() {
    cleanupCallbacks.forEach(function (callback) { try { callback(); } catch (_error) {} });
    if (supabase && typeof supabase.removeAllChannels === 'function') {
      try { supabase.removeAllChannels(); } catch (_error) {}
    }
  }

  async function performPortalLogout(options) {
    const settings = options || {};
    if (logoutInProgress) return;
    logoutInProgress = true;
    clearTimers();
    runCleanup();
    global.localStorage.removeItem(EXPIRY_KEY);
    if (settings.broadcast !== false) broadcast(settings.reason === 'session_expired' ? 'expired' : 'logout');
    try {
      if (supabase) {
        const result = await supabase.auth.signOut();
        if (result && result.error) await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (_error) {
      try { if (supabase) await supabase.auth.signOut({ scope: 'local' }); } catch (_localError) {}
    }
    if (settings.redirect !== false) global.location.replace(loginUrl(settings.reason));
  }

  function checkExpiry() {
    const expiresAt = readExpiry();
    if (!expiresAt || Date.now() >= expiresAt) {
      performPortalLogout({ reason: 'session_expired' });
      return false;
    }
    return true;
  }

  function schedule(expiresAt) {
    clearTimers();
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) { performPortalLogout({ reason: 'session_expired' }); return false; }
    if (remaining <= WARNING_BEFORE_MS) showWarning();
    else warningTimer = global.setTimeout(showWarning, remaining - WARNING_BEFORE_MS);
    expiryTimer = global.setTimeout(function () { performPortalLogout({ reason: 'session_expired' }); }, remaining);
    return true;
  }

  function installListeners() {
    if (listenersInstalled) return;
    listenersInstalled = true;
    if ('BroadcastChannel' in global) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener('message', function (event) {
        if (event.data && ['logout', 'expired'].includes(event.data.type)) performPortalLogout({ reason: event.data.type === 'expired' ? 'session_expired' : 'manual', broadcast: false });
      });
    }
    function revalidate() { if (checkExpiry()) schedule(readExpiry()); }
    global.addEventListener('storage', function (event) {
      if (event.key === EXPIRY_KEY || event.key === EVENT_KEY) revalidate();
    });
    global.addEventListener('focus', revalidate);
    global.addEventListener('pageshow', revalidate);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) revalidate(); });
  }

  function configure(options) {
    if (options && options.supabase) supabase = options.supabase;
    if (options && options.role === 'admin') role = 'admin';
    else if (options && options.role === 'client') role = 'client';
    installListeners();
  }

  function startPortalSessionTimeout(options) {
    configure(options);
    let expiresAt = readExpiry();
    if (options && options.newSession === true) {
      expiresAt = Date.now() + PORTAL_SESSION_DURATION_MS;
      global.localStorage.setItem(EXPIRY_KEY, String(expiresAt));
      broadcast('started');
    }
    if (!expiresAt) return false;
    return schedule(expiresAt);
  }

  async function validatePortalSession(options) {
    configure(options);
    const result = await supabase.auth.getSession();
    if (result.error || !result.data.session || !readExpiry() || Date.now() >= readExpiry()) {
      await performPortalLogout({ reason: 'session_expired' });
      return null;
    }
    schedule(readExpiry());
    return result.data.session;
  }

  function registerCleanup(callback) {
    if (typeof callback === 'function') cleanupCallbacks.add(callback);
    return function () { cleanupCallbacks.delete(callback); };
  }

  global.ZyntraPortalSession = Object.freeze({
    PORTAL_SESSION_DURATION_MS: PORTAL_SESSION_DURATION_MS,
    startPortalSessionTimeout: startPortalSessionTimeout,
    validatePortalSession: validatePortalSession,
    clearPortalSessionTimeout: clearPortalSessionTimeout,
    performPortalLogout: performPortalLogout,
    registerCleanup: registerCleanup,
    readExpiry: readExpiry
  });
}(window));
