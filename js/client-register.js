(function initializeClientRegistration(global) {
  'use strict';

  const form = document.getElementById('client-register-form');
  const loading = document.getElementById('register-loading');
  const status = document.getElementById('register-status');
  const submit = document.getElementById('register-submit');
  const submitLabel = document.getElementById('register-submit-label');
  const clientMessage = document.getElementById('client-session-message');
  const loginLink = document.getElementById('register-login-link');
  const dashboardLink = document.getElementById('register-dashboard-link');
  const publicFields = Array.prototype.slice.call(document.querySelectorAll('.client-register-public'));
  const password = document.getElementById('register-password');
  const confirmation = document.getElementById('register-confirm-password');
  const strengthBar = document.getElementById('password-strength-bar');
  const clientIdInput = document.getElementById('register-client-id');
  const clientIdStatus = document.getElementById('client-id-status');
  const captchaContainer = document.getElementById('register-captcha');
  const idPattern = /^[A-Z0-9-]{5,24}$/;
  const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
  let mode = 'loading';
  let submitting = false;
  const auth = global.ZyntraClientAuth;
  let supabase;
  try {
    if (!auth) throw new Error('Supabase configuration is missing.');
    supabase = auth.client();
  } catch (error) {
    loading.textContent = String(error.message || error);
    loading.classList.add('is-error');
    return;
  }

  function showStatus(message, isError) {
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }

  async function edgeErrorMessage(result, fallback) {
    if (result && result.data && result.data.error) return result.data.error;
    try {
      if (result && result.error && result.error.context && typeof result.error.context.json === 'function') {
        const body = await result.error.context.json();
        if (body && body.error) return body.error;
      }
    } catch (_error) { /* use safe fallback */ }
    return fallback;
  }

  function setSubmitting(value) {
    submitting = value;
    submit.disabled = value;
    submit.classList.toggle('is-loading', value);
    submitLabel.textContent = value ? (mode === 'admin' ? 'Sending Invitation…' : 'Creating Account…') : (mode === 'admin' ? 'Send Client Invitation' : 'Register Client');
    Array.prototype.slice.call(form.elements).forEach(function (control) { if (control !== submit) control.disabled = value; });
  }

  function configurePublicMode() {
    mode = 'public';
    document.getElementById('register-eyebrow').textContent = 'Secure client registration';
    document.getElementById('register-title').textContent = 'Register for Client Portal';
    document.getElementById('register-description').textContent = 'Create your secure Zyntra Studio Client Portal account to review projects, approvals and completed work.';
    document.getElementById('register-email-label').textContent = 'Email Address';
    publicFields.forEach(function (node) { node.hidden = false; });
    password.required = true;
    confirmation.required = true;
    document.getElementById('register-terms').required = true;
    submitLabel.textContent = 'Register Client';
    loading.hidden = true;
    clientMessage.hidden = true;
    dashboardLink.hidden = true;
    loginLink.hidden = false;
    form.hidden = false;
    captchaContainer.hidden = false;
    if (global.ZyntraCaptcha && global.ZyntraCaptcha.configured()) {
      global.ZyntraCaptcha.render('register-captcha').catch(function () { showStatus('The security check could not be loaded. Refresh and try again.', true); });
    }
  }

  function configureAdminMode(profile) {
    mode = 'admin';
    document.getElementById('register-eyebrow').textContent = 'Administrator client invitation';
    document.getElementById('register-title').textContent = 'Register Client as Admin';
    document.getElementById('register-description').textContent = 'Send a secure invitation without viewing or setting the client’s permanent password.';
    document.getElementById('register-email-label').textContent = 'Client Email';
    publicFields.forEach(function (node) { node.hidden = true; });
    password.required = false;
    confirmation.required = false;
    document.getElementById('register-terms').required = false;
    submitLabel.textContent = 'Send Client Invitation';
    loading.hidden = true;
    clientMessage.hidden = true;
    loginLink.hidden = true;
    dashboardLink.hidden = false;
    form.hidden = false;
    captchaContainer.hidden = true;
    showStatus('Signed in as ' + (profile.full_name || 'Administrator') + '.', false);
  }

  function configureClientMode() {
    mode = 'client';
    loading.hidden = true;
    form.hidden = true;
    loginLink.hidden = true;
    dashboardLink.hidden = true;
    clientMessage.hidden = false;
  }

  function strengthScore(value) {
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  }

  password.addEventListener('input', function () {
    const score = strengthScore(password.value);
    strengthBar.style.width = (score * 25) + '%';
    strengthBar.style.backgroundColor = score < 2 ? '#ff8398' : score < 4 ? '#ffd45c' : '#71e5bd';
  });

  function normalizeClientId(value) { return value.trim().toUpperCase(); }
  function clientIdValid(value) { return value === '' || (idPattern.test(value) && !reservedIds.has(value)); }
  function validateClientId(showAvailable) {
    const normalized = normalizeClientId(clientIdInput.value);
    clientIdInput.value = normalized;
    const valid = clientIdValid(normalized);
    clientIdInput.setCustomValidity(valid ? '' : 'Use 5–24 English letters, numbers or hyphens and avoid reserved names.');
    clientIdStatus.textContent = valid ? (normalized && showAvailable ? 'Format valid. Availability is confirmed securely when you submit.' : '') : 'Use 5–24 English letters, numbers or hyphens and avoid reserved names.';
    clientIdStatus.classList.toggle('is-error', !valid);
    return valid;
  }
  clientIdInput.addEventListener('input', function () { validateClientId(false); });
  clientIdInput.addEventListener('blur', function () { validateClientId(true); });

  document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
    button.addEventListener('click', function () {
      const input = document.getElementById(button.dataset.passwordToggle);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'Hide' : 'Show';
      button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    });
  });

  async function registerPublic(payload) {
    const captcha = global.ZyntraCaptcha;
    if (!captcha || !captcha.configured()) throw new Error('Registration security verification is not configured.');
    await captcha.render('register-captcha');
    const captchaToken = captcha.token('register-captcha');
    if (!captchaToken) throw new Error('Complete the security verification before registering.');
    const result = await supabase.functions.invoke('register-client', { body: { email: payload.email, password: payload.password, fullName: payload.fullName, businessName: payload.businessName, phone: payload.phone, clientId: payload.clientId || null, captchaToken: captchaToken } });
    captcha.reset('register-captcha');
    if (result.error || !result.data || result.data.success !== true) throw new Error(await edgeErrorMessage(result, 'Registration failed.'));
    form.reset();
    strengthBar.style.width = '0';
    clientIdStatus.textContent = '';
    if (result.data.session) {
      const sessionResult = await supabase.auth.setSession({ access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token });
      if (sessionResult.error || !sessionResult.data.session) throw sessionResult.error || new Error('The new session could not be established.');
      await auth.validateSessionForRole(sessionResult.data.session, 'client');
      if (global.ZyntraPortalSession) global.ZyntraPortalSession.startPortalSessionTimeout({ supabase: supabase, role: 'client', newSession: true });
      await supabase.rpc('activate_my_client_login_id');
      global.location.replace('client-portal.html');
      return;
    }
    showStatus('Registration successful. Please check your email to confirm your account.', false);
  }

  async function inviteAsAdmin(payload) {
    const result = await supabase.functions.invoke('invite-client', {
      body: { email: payload.email, full_name: payload.fullName, business_name: payload.businessName, phone: payload.phone, client_login_id: payload.clientId || null }
    });
    if (result.error || !result.data || result.data.success !== true) throw new Error(await edgeErrorMessage(result, 'Invitation failed.'));
    form.reset();
    showStatus('Client invitation sent successfully.', false);
    dashboardLink.hidden = false;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitting || !['public', 'admin'].includes(mode)) return;
    showStatus('', false);
    if (!validateClientId(true) || !form.reportValidity()) return;
    const payload = {
      fullName: document.getElementById('register-full-name').value.trim(),
      businessName: document.getElementById('register-business-name').value.trim(),
      email: document.getElementById('register-email').value.trim().toLowerCase(),
      clientId: normalizeClientId(clientIdInput.value),
      phone: document.getElementById('register-phone').value.trim(),
      password: password.value
    };
    if (mode === 'public' && password.value !== confirmation.value) {
      showStatus('The passwords do not match.', true);
      confirmation.focus();
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'admin') await inviteAsAdmin(payload);
      else await registerPublic(payload);
    } catch (error) {
      const rawMessage = String(error.message || '');
      const message = payload.clientId && /database|duplicate|unique|client id|unavailable/i.test(rawMessage)
        ? 'That Client ID is unavailable. Choose another ID or leave it empty.'
        : /already|registered|exists/i.test(rawMessage)
        ? 'An account with this email already exists. Use Client Login or reset the password.'
        : auth.safeMessage(error, mode === 'admin' ? 'The client invitation could not be sent. Please try again.' : 'Registration failed. Please try again.');
      showStatus(message, true);
    } finally {
      if (!global.location.href.endsWith('client-portal.html')) setSubmitting(false);
    }
  });

  document.getElementById('logout-register').addEventListener('click', async function () {
    this.disabled = true;
    if (global.ZyntraPortalSession) await global.ZyntraPortalSession.performPortalLogout({ reason: 'manual', redirect: false });
    else { const result = await supabase.auth.signOut(); if (result.error) { this.disabled = false; clientMessage.querySelector('p').textContent = 'Logout failed. Please try again.'; return; } }
    form.reset();
    configurePublicMode();
    document.getElementById('register-full-name').focus();
  });

  (async function start() {
    try {
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;
      const session = sessionResult.data.session;
      if (!session) { configurePublicMode(); return; }
      const profile = await auth.getProfile(session.user.id);
      const role = String(profile.role || '').trim().toLowerCase();
      if (profile.active !== true || !['admin', 'client'].includes(role)) {
        await supabase.auth.signOut();
        configurePublicMode();
        showStatus(profile.active !== true ? 'This account is inactive. Contact Zyntra Studio.' : 'We could not verify your portal access. Please try again.', true);
        return;
      }
      if (global.ZyntraPortalSession) {
        const timedSession = await global.ZyntraPortalSession.validatePortalSession({ supabase: supabase, role: role });
        if (!timedSession) return;
      }
      if (role === 'admin') configureAdminMode(profile);
      else configureClientMode();
    } catch (error) {
      try { await supabase.auth.signOut(); } catch (signOutError) { /* best effort */ }
      configurePublicMode();
      showStatus(auth.safeMessage(error, 'We could not verify your portal access. Please try again.'), true);
    }
  }());
}(window));
