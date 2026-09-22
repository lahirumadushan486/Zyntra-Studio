(function initializePortalLogin(global) {
  'use strict';
  const entryRole = document.body.dataset.loginRole === 'admin' ? 'admin' : 'client';
  const form = document.getElementById('portal-login-form');
  const requestForm = document.getElementById('password-request-form');
  const status = document.getElementById('login-status');
  const requestStatus = document.getElementById('password-request-status');
  const roleHelp = document.getElementById('role-help-link');
  const submit = document.getElementById('login-submit');
  const password = document.getElementById('login-password');
  const identifier = document.getElementById(entryRole === 'client' ? 'login-identifier' : 'login-email');
  const idPattern = /^[A-Z0-9-]{5,24}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
  const neutralResetMessage = 'If an account exists for this email address, a password reset link has been sent.';
  let auth;
  let supabase;
  let processing = false;
  let redirecting = false;
  let initializing = true;
  let resetRequesting = false;
  let resetCooldownUntil = 0;
  let resetCooldownTimer = 0;

  function showStatus(target, message, isError) { target.textContent = message || ''; target.classList.toggle('is-error', Boolean(isError)); }
  function hideRoleHelp() { roleHelp.hidden = true; roleHelp.removeAttribute('href'); }
  function showRoleHelp() { roleHelp.textContent = entryRole === 'client' ? 'Go to Admin Login' : 'Go to Client Login'; roleHelp.href = entryRole === 'client' ? 'admin-login.html' : 'client-login.html'; roleHelp.hidden = false; }
  function setLoading(value) { submit.disabled = value || initializing; submit.classList.toggle('is-loading', value); submit.querySelector('[data-button-label]').textContent = value ? 'Signing In…' : 'Sign In'; }
  function showOnly(target) { form.hidden = target !== form; requestForm.hidden = target !== requestForm; }
  function destinationForEntry() { return entryRole === 'admin' ? auth.routes.adminDashboard : auth.routes.clientDashboard; }
  function credentialError() { return 'The email, Client ID or password is incorrect.'; }

  async function validateAndRedirect(session, isNewSession) {
    if (processing || redirecting) return;
    processing = true;
    hideRoleHelp();
    try {
      if (!isNewSession && global.ZyntraPortalSession) {
        const timedSession = await global.ZyntraPortalSession.validatePortalSession({ supabase: supabase, role: entryRole });
        if (!timedSession) return;
      }
      const profile = await auth.validateSessionForRole(session, entryRole);
      if (global.ZyntraPortalSession) global.ZyntraPortalSession.startPortalSessionTimeout({ supabase: supabase, role: entryRole, newSession: Boolean(isNewSession) });
      if (entryRole === 'client') {
        await supabase.rpc('activate_my_client_login_id');
        if (profile.must_change_password === true) {
          redirecting = true;
          global.location.replace(auth.routes.clientPasswordReset + '?mode=change');
          return;
        }
      }
      redirecting = true;
      global.location.replace(destinationForEntry());
    } catch (error) {
      let message = auth.safeMessage(error, 'We could not verify your portal access. Please try again.');
      if (error && error.code === 'wrong_role') message = entryRole === 'client' ? 'Please use the Admin Login page.' : 'This account does not have Admin access.';
      showStatus(status, message, true);
      if (error && error.code === 'wrong_role' && entryRole === 'client') showRoleHelp();
      processing = false;
      setLoading(false);
    }
  }

  try {
    auth = global.ZyntraClientAuth;
    if (!auth) throw new Error('Supabase configuration is missing.');
    supabase = auth.client();
  } catch (error) {
    showStatus(status, String(error.message || error), true);
    submit.disabled = true;
    return;
  }

  submit.disabled = true;
  document.getElementById('toggle-password').addEventListener('click', function () {
    const reveal = password.type === 'password';
    password.type = reveal ? 'text' : 'password';
    this.textContent = reveal ? 'Hide' : 'Show';
    this.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  });

  async function clientIdSignIn(loginId) {
    const captcha = global.ZyntraCaptcha;
    if (!captcha || !captcha.configured()) throw new Error('Client ID login security verification is not configured.');
    await captcha.render('client-login-captcha');
    const captchaToken = captcha.token('client-login-captcha');
    if (!captchaToken) throw new Error('Complete the security verification before signing in.');
    const result = await supabase.functions.invoke('login-with-client-id', { body: { loginId: loginId, password: password.value, captchaToken: captchaToken } });
    captcha.reset('client-login-captcha');
    if (result.error || !result.data || result.data.success !== true || !result.data.session) {
      let detail = String(result.error && result.error.message || result.data && result.data.error || '');
      try { if (result.error && result.error.context && typeof result.error.context.json === 'function') { const body = await result.error.context.json(); detail = String(body && body.error || detail); } } catch (_error) {}
      throw new Error(/too many|rate/i.test(detail) ? 'Too many attempts. Please wait and try again.' : credentialError());
    }
    const sessionResult = await supabase.auth.setSession({ access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token });
    if (sessionResult.error || !sessionResult.data.session) throw sessionResult.error || new Error(credentialError());
    return sessionResult.data.session;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (initializing || processing || redirecting) return;
    showStatus(status, '', false);
    hideRoleHelp();
    if (!form.reportValidity()) return;
    setLoading(true);
    try {
      const value = identifier.value.trim();
      let session;
      if (entryRole === 'client' && !value.includes('@')) {
        const loginId = value.toUpperCase();
        if (!idPattern.test(loginId) || reservedIds.has(loginId)) throw new Error(credentialError());
        session = await clientIdSignIn(loginId);
      } else {
        const email = value.toLowerCase();
        if (!emailPattern.test(email)) throw new Error(credentialError());
        const result = await supabase.auth.signInWithPassword({ email: email, password: password.value });
        if (result.error || !result.data.session) throw result.error || new Error(credentialError());
        session = result.data.session;
      }
      password.value = '';
      await validateAndRedirect(session, true);
    } catch (error) {
      password.value = '';
      const message = /invalid login credentials/i.test(String(error && error.message || '')) ? credentialError() : auth.safeMessage(error, String(error && error.message || credentialError()));
      showStatus(status, message, true);
      setLoading(false);
      processing = false;
    }
  });

  document.getElementById('forgot-password').addEventListener('click', function () {
    showStatus(requestStatus, '', false);
    showOnly(requestForm);
    hideRoleHelp();
    document.getElementById('reset-email').focus();
  });
  document.getElementById('password-request-cancel').addEventListener('click', function () { showOnly(form); identifier.focus(); });

  function startResetCooldown(button) {
    resetCooldownUntil = Date.now() + 60000;
    global.clearInterval(resetCooldownTimer);
    resetCooldownTimer = global.setInterval(function () {
      const remaining = Math.ceil((resetCooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        global.clearInterval(resetCooldownTimer);
        button.disabled = false;
        button.textContent = 'Send Reset Link';
      } else {
        button.textContent = 'Try again in ' + remaining + 's';
      }
    }, 1000);
  }

  requestForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (resetRequesting || !requestForm.reportValidity()) return;
    const button = document.getElementById('password-request-submit');
    if (Date.now() < resetCooldownUntil) {
      showStatus(requestStatus, 'Please wait before requesting another password reset email.', true);
      return;
    }
    const email = document.getElementById('reset-email').value.trim().toLowerCase();
    if (!emailPattern.test(email)) return;
    button.disabled = true;
    button.textContent = 'Sending reset link...';
    resetRequesting = true;
    let rateLimited = false;
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: auth.passwordResetUrl() });
      rateLimited = Boolean(result.error && /rate|too many|security purposes/i.test(result.error.message || ''));
    } catch (_error) { /* preserve the privacy-safe response */ }
    showStatus(requestStatus, rateLimited ? 'Please wait before requesting another password reset email.' : neutralResetMessage, rateLimited);
    startResetCooldown(button);
    resetRequesting = false;
  });

  const code = new URLSearchParams(global.location.search).get('error');
  const reason = new URLSearchParams(global.location.search).get('reason');
  const messages = { session: 'Your session has expired. Please sign in again.', session_missing: 'Your session has expired. Please sign in again.', profile_missing: 'Your portal profile has not been created. Contact Zyntra Studio.', inactive: 'This account is inactive. Contact Zyntra Studio.', profile_error: 'We could not verify your portal access. Please try again.', 'wrong-role': entryRole === 'client' ? 'Please use the Admin Login page.' : 'This account does not have Admin access.' };
  if (reason === 'session_expired') showStatus(status, 'Your session expired after 15 minutes. Please sign in again.', true);
  else if (code) { showStatus(status, messages[code] || 'Please sign in again to continue.', true); if (code === 'wrong-role' && entryRole === 'client') showRoleHelp(); } else hideRoleHelp();
  if (entryRole === 'client' && global.ZyntraCaptcha && global.ZyntraCaptcha.configured()) global.ZyntraCaptcha.render('client-login-captcha').catch(function () {});

  supabase.auth.getSession().then(async function (result) {
    initializing = false;
    setLoading(false);
    if (result.error) { if (global.ZyntraPortalSession) global.ZyntraPortalSession.clearPortalSessionTimeout(); await supabase.auth.signOut({ scope: 'local' }); showStatus(status, 'We could not verify your portal access. Please try again.', true); return; }
    if (!result.data.session && global.ZyntraPortalSession && global.ZyntraPortalSession.readExpiry()) global.ZyntraPortalSession.clearPortalSessionTimeout();
    if (result.data.session) await validateAndRedirect(result.data.session, false);
  }).catch(async function () {
    initializing = false;
    setLoading(false);
    if (global.ZyntraPortalSession) global.ZyntraPortalSession.clearPortalSessionTimeout();
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (_error) {}
    showStatus(status, 'We could not verify your portal access. Please try again.', true);
  });
}(window));
