(function initializeClientRegistration(global) {
  'use strict';

  const form = document.getElementById('client-register-form');
  const loading = document.getElementById('register-loading');
  const status = document.getElementById('register-status');
  const submit = document.getElementById('register-submit');
  const submitLabel = document.getElementById('register-submit-label');
  const password = document.getElementById('register-password');
  const confirmation = document.getElementById('register-confirm-password');
  const strengthBar = document.getElementById('password-strength-bar');
  const clientIdInput = document.getElementById('register-client-id');
  const clientIdStatus = document.getElementById('client-id-status');
  const dashboardLink = document.getElementById('register-dashboard-link');
  const idPattern = /^[A-Z0-9-]{5,24}$/;
  const reservedIds = new Set(['ADMIN', 'ADMINISTRATOR', 'ROOT', 'SUPPORT', 'ZYNTRA', 'SYSTEM', 'CLIENT', 'LOGIN', 'NULL']);
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
  const auth = global.ZyntraClientAuth;
  let supabase;
  let submitting = false;

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
    } catch (_error) { /* use the safe fallback */ }
    return fallback;
  }

  function setSubmitting(value) {
    submitting = value;
    submit.disabled = value;
    submit.classList.toggle('is-loading', value);
    submitLabel.textContent = value ? 'Creating Account…' : 'Register Client';
    Array.prototype.slice.call(form.elements).forEach(function (control) {
      if (control !== submit) control.disabled = value;
    });
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
  function validateClientId(showAvailable) {
    const normalized = normalizeClientId(clientIdInput.value);
    clientIdInput.value = normalized;
    const valid = normalized === '' || (idPattern.test(normalized) && !reservedIds.has(normalized));
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

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitting) return;
    showStatus('', false);
    if (!validateClientId(true) || !form.reportValidity()) return;
    if (!strongPassword.test(password.value)) {
      showStatus('Please enter a stronger password.', true);
      password.focus();
      return;
    }
    if (password.value !== confirmation.value) {
      showStatus('The passwords do not match.', true);
      confirmation.focus();
      return;
    }

    const payload = {
      fullName: document.getElementById('register-full-name').value.trim(),
      businessName: document.getElementById('register-business-name').value.trim(),
      email: document.getElementById('register-email').value.trim().toLowerCase(),
      clientId: normalizeClientId(clientIdInput.value) || null,
      phone: document.getElementById('register-phone').value.trim(),
      password: password.value
    };
    setSubmitting(true);
    try {
      const result = await supabase.functions.invoke('register-client', { body: payload });
      if (result.error || !result.data || result.data.success !== true) throw new Error(await edgeErrorMessage(result, 'The client account could not be created.'));
      form.reset();
      password.value = '';
      confirmation.value = '';
      strengthBar.style.width = '0';
      clientIdStatus.textContent = '';
      showStatus('Client account created successfully. The client can now sign in with the temporary password and must change it before entering the portal.', false);
      try { global.localStorage.setItem('zyntra_portal_clients_changed', String(Date.now())); } catch (_error) {}
    } catch (error) {
      const raw = String(error && error.message || '');
      const message = /stronger password/i.test(raw) ? 'Please enter a stronger password.'
        : /client id.*unavailable/i.test(raw) ? 'That Client ID is unavailable. Choose another ID or leave it empty.'
        : /already|registered|exists/i.test(raw) ? 'An account with this email already exists.'
        : auth.safeMessage(error, 'The client account could not be created. Please try again.');
      showStatus(message, true);
    } finally {
      payload.password = '';
      setSubmitting(false);
    }
  });

  (async function start() {
    const context = await auth.requireAccess('admin');
    if (!context) return;
    auth.watchProtectedSession('admin');
    document.getElementById('register-terms').closest('label').hidden = true;
    document.getElementById('register-terms').required = false;
    document.getElementById('register-captcha').hidden = true;
    document.getElementById('register-login-link').hidden = true;
    document.getElementById('client-session-message').hidden = true;
    dashboardLink.hidden = false;
    loading.hidden = true;
    form.hidden = false;
    showStatus('Signed in as ' + (context.profile.full_name || 'Administrator') + '.', false);
  }()).catch(function () {
    loading.textContent = 'Administrator access could not be verified.';
    loading.classList.add('is-error');
  });
}(window));
