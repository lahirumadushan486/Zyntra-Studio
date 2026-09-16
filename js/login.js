(function initializePortalLogin(global) {
  'use strict';
  const entryRole = document.body.dataset.loginRole === 'admin' ? 'admin' : 'client';
  const form = document.getElementById('portal-login-form');
  const requestForm = document.getElementById('password-request-form');
  const recoveryForm = document.getElementById('password-reset-form');
  const status = document.getElementById('login-status');
  const requestStatus = document.getElementById('password-request-status');
  const recoveryStatus = document.getElementById('reset-status');
  const roleHelp = document.getElementById('role-help-link');
  const submit = document.getElementById('login-submit');
  const password = document.getElementById('login-password');
  const identifier = document.getElementById(entryRole === 'client' ? 'login-identifier' : 'login-email');
  const idPattern = /^[A-Z0-9-]{5,24}$/;
  const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
  let auth;
  let supabase;
  let recoveryMode = /(?:#|[?&])type=(?:recovery|invite)(?:&|$)/.test(global.location.href);
  const confirmationMode = /(?:#|[?&])type=signup(?:&|$)/.test(global.location.href);
  let processing = false;
  let redirecting = false;
  let initializing = true;

  function showStatus(target, message, isError) { target.textContent = message || ''; target.classList.toggle('is-error', Boolean(isError)); }
  function hideRoleHelp() { roleHelp.hidden = true; roleHelp.removeAttribute('href'); }
  function showRoleHelp() { roleHelp.textContent = entryRole === 'client' ? 'Go to Admin Login' : 'Go to Client Login'; roleHelp.href = entryRole === 'client' ? 'admin-login.html' : 'client-login.html'; roleHelp.hidden = false; }
  function setLoading(value) { submit.disabled = value || initializing; submit.classList.toggle('is-loading', value); submit.querySelector('[data-button-label]').textContent = value ? 'Signing In…' : 'Sign In'; }
  function showOnly(target) { form.hidden = target !== form; requestForm.hidden = target !== requestForm; recoveryForm.hidden = target !== recoveryForm; }
  function showRecovery() { recoveryMode = true; showOnly(recoveryForm); hideRoleHelp(); document.getElementById('new-password').focus(); }
  function destinationForEntry() { return entryRole === 'admin' ? auth.routes.adminDashboard : auth.routes.clientDashboard; }
  function credentialError() { return 'The email, Client ID or password is incorrect.'; }

  async function validateAndRedirect(session, isNewSession) {
    if (recoveryMode || processing || redirecting) return;
    processing = true;
    hideRoleHelp();
    try {
      if (!isNewSession && global.ZyntraPortalSession) {
        const timedSession = await global.ZyntraPortalSession.validatePortalSession({ supabase: supabase, role: entryRole });
        if (!timedSession) return;
      }
      await auth.validateSessionForRole(session, entryRole);
      if (global.ZyntraPortalSession) global.ZyntraPortalSession.startPortalSessionTimeout({ supabase: supabase, role: entryRole, newSession: Boolean(isNewSession) });
      if (entryRole === 'client') await supabase.rpc('activate_my_client_login_id');
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
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(credentialError());
        const result = await supabase.auth.signInWithPassword({ email: email, password: password.value });
        if (result.error || !result.data.session) throw result.error || new Error(credentialError());
        session = result.data.session;
      }
      await validateAndRedirect(session, true);
    } catch (error) {
      const message = /invalid login credentials/i.test(String(error && error.message || '')) ? credentialError() : auth.safeMessage(error, String(error && error.message || credentialError()));
      showStatus(status, message, true);
      setLoading(false);
      processing = false;
    }
  });

  document.getElementById('forgot-password').addEventListener('click', function () { showStatus(requestStatus, '', false); showOnly(requestForm); hideRoleHelp(); document.getElementById('reset-email').focus(); });
  document.getElementById('password-request-cancel').addEventListener('click', function () { showOnly(form); identifier.focus(); });
  requestForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!requestForm.reportValidity()) return;
    const button = document.getElementById('password-request-submit');
    const email = document.getElementById('reset-email').value.trim().toLowerCase();
    button.disabled = true;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: entryRole === 'admin' ? 'https://zyntrastudio.lk/admin-login.html' : 'https://zyntrastudio.lk/client-login.html' });
    showStatus(requestStatus, 'If an account exists for this email, a password reset link has been sent.', false);
    button.disabled = false;
  });

  recoveryForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const next = document.getElementById('new-password');
    const confirmation = document.getElementById('confirm-password');
    const resetSubmit = document.getElementById('reset-submit');
    showStatus(recoveryStatus, '', false);
    if (!recoveryForm.reportValidity()) return;
    if (next.value !== confirmation.value) { showStatus(recoveryStatus, 'The passwords do not match.', true); confirmation.focus(); return; }
    resetSubmit.disabled = true;
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error || !sessionResult.data.session) { showStatus(recoveryStatus, 'This password reset link is invalid or has expired. Request a new one.', true); resetSubmit.disabled = false; return; }
    const result = await supabase.auth.updateUser({ password: next.value });
    if (result.error) { showStatus(recoveryStatus, auth.safeMessage(result.error, 'Your password could not be updated. Request a new reset link.'), true); resetSubmit.disabled = false; return; }
    recoveryMode = false;
    showOnly(form);
    await validateAndRedirect(sessionResult.data.session, true);
  });

  supabase.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') showRecovery(); });
  const code = new URLSearchParams(global.location.search).get('error');
  const reason = new URLSearchParams(global.location.search).get('reason');
  const messages = { session: 'Your session has expired. Please sign in again.', session_missing: 'Your session has expired. Please sign in again.', profile_missing: 'Your portal profile has not been created. Contact Zyntra Studio.', inactive: 'This account is inactive. Contact Zyntra Studio.', profile_error: 'We could not verify your portal access. Please try again.', 'wrong-role': entryRole === 'client' ? 'Please use the Admin Login page.' : 'This account does not have Admin access.' };
  if (reason === 'session_expired') showStatus(status, 'Your session expired after 15 minutes. Please sign in again.', true);
  else if (code) { showStatus(status, messages[code] || 'Please sign in again to continue.', true); if (code === 'wrong-role' && entryRole === 'client') showRoleHelp(); } else hideRoleHelp();
  if (recoveryMode) showRecovery();
  if (entryRole === 'client' && global.ZyntraCaptcha && global.ZyntraCaptcha.configured()) global.ZyntraCaptcha.render('client-login-captcha').catch(function () {});

  supabase.auth.getSession().then(async function (result) {
    initializing = false;
    setLoading(false);
    if (result.error) { if(global.ZyntraPortalSession)global.ZyntraPortalSession.clearPortalSessionTimeout();await supabase.auth.signOut(); showStatus(status, 'We could not verify your portal access. Please try again.', true); return; }
    if (!result.data.session && global.ZyntraPortalSession && global.ZyntraPortalSession.readExpiry()) global.ZyntraPortalSession.clearPortalSessionTimeout();
    if (result.data.session && !recoveryMode) await validateAndRedirect(result.data.session, confirmationMode);
  }).catch(async function () {
    initializing = false;
    setLoading(false);
    if(global.ZyntraPortalSession)global.ZyntraPortalSession.clearPortalSessionTimeout();
    try { await supabase.auth.signOut(); } catch (_error) {}
    showStatus(status, 'We could not verify your portal access. Please try again.', true);
  });
}(window));
