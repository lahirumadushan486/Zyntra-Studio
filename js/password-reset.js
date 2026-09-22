(function initializePasswordReset(global) {
  'use strict';

  const auth = global.ZyntraClientAuth;
  const form = document.getElementById('secure-password-reset-form');
  const sessionStatus = document.getElementById('reset-session-status');
  const invalidPanel = document.getElementById('invalid-reset-link');
  const status = document.getElementById('secure-reset-status');
  const submit = document.getElementById('secure-reset-submit');
  const submitLabel = submit.querySelector('[data-reset-submit-label]');
  const password = document.getElementById('secure-new-password');
  const confirmation = document.getElementById('secure-confirm-password');
  const strengthBar = document.getElementById('secure-password-strength-bar');
  const requestAnother = document.getElementById('request-another-reset');
  const changeMode = new URLSearchParams(global.location.search).get('mode') === 'change';
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
  let supabase;
  let authorized = false;
  let submitting = false;
  let initialized = false;
  let recoveryEventReceived = false;
  let recoveryEmail = '';
  let recoveryRole = '';
  let requestCooldownUntil = 0;
  let requestTimer = 0;

  function showStatus(message, isError) {
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }
  function cleanSensitiveUrl() {
    const cleanPath = global.location.pathname + (changeMode ? '?mode=change' : '');
    global.history.replaceState(null, '', cleanPath);
  }
  function rejectSession() {
    authorized = false;
    sessionStatus.hidden = true;
    form.hidden = true;
    invalidPanel.hidden = false;
    password.value = '';
    confirmation.value = '';
    cleanSensitiveUrl();
  }
  async function validatePasswordSession(session, requirePasswordChange) {
    if (!session || !session.user || !session.access_token) return false;
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user || userResult.data.user.id !== session.user.id) return false;
    const profile = await auth.getProfile(session.user.id);
    if (!['client', 'admin'].includes(profile.role) || profile.active !== true) return false;
    if (requirePasswordChange && (profile.role !== 'client' || profile.must_change_password !== true)) return false;
    recoveryEmail = String(userResult.data.user.email || '').trim().toLowerCase();
    recoveryRole = profile.role;
    return true;
  }
  async function authorize(session, requirePasswordChange) {
    try {
      if (!(await validatePasswordSession(session, requirePasswordChange))) { rejectSession(); return; }
      authorized = true;
      cleanSensitiveUrl();
      sessionStatus.hidden = true;
      invalidPanel.hidden = true;
      form.hidden = false;
      requestAnother.hidden = !requirePasswordChange;
      if (global.ZyntraPortalSession && requirePasswordChange) {
        global.ZyntraPortalSession.startPortalSessionTimeout({ supabase: supabase, role: 'client', newSession: false });
      }
    } catch (_error) { rejectSession(); }
  }
  function strengthScore(value) {
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  }
  function clearPasswords() {
    password.value = '';
    confirmation.value = '';
    strengthBar.style.width = '0';
  }
  try {
    if (!auth) throw new Error('Missing authentication configuration.');
    supabase = auth.client();
  } catch (_error) {
    rejectSession();
    return;
  }

  password.addEventListener('input', function () {
    const score = strengthScore(password.value);
    strengthBar.style.width = (score * 25) + '%';
    strengthBar.style.backgroundColor = score < 2 ? '#ff8398' : score < 4 ? '#ffd45c' : '#71e5bd';
  });
  document.querySelectorAll('[data-reset-password-toggle]').forEach(function (button) {
    button.addEventListener('click', function () {
      const input = document.getElementById(button.dataset.resetPasswordToggle);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'Hide' : 'Show';
      button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    });
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!authorized || submitting || !form.reportValidity()) return;
    showStatus('', false);
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
    submitting = true;
    submit.disabled = true;
    submit.classList.add('is-loading');
    submitLabel.textContent = 'Updating Password…';
    let newPassword = password.value;
    clearPasswords();
    try {
      const result = await supabase.auth.updateUser({ password: newPassword });
      if (result.error || !result.data.user) {
        if (/session|invalid|expired|jwt/i.test(result.error?.message || '')) { rejectSession(); return; }
        throw result.error || new Error('Password update failed.');
      }
      authorized = false;
      if (global.ZyntraPortalSession) global.ZyntraPortalSession.clearPortalSessionTimeout();
      try { await supabase.auth.signOut({ scope: 'others' }); } catch (_signOutError) { /* best effort */ }
      try { await supabase.auth.signOut({ scope: 'local' }); } catch (_signOutError) { /* local redirect still follows */ }
      form.reset();
      form.querySelectorAll('input').forEach(function (input) { input.value = ''; });
      showStatus('Your password has been updated successfully. You can now log in with your new password.', false);
      submit.hidden = true;
      requestAnother.hidden = true;
      const loginPage = recoveryRole === 'admin' ? '../../admin-login.html' : '../../client-login.html';
      global.setTimeout(function () { global.location.replace(loginPage + '?password=updated'); }, 2200);
    } catch (_error) {
      showStatus('The password could not be updated. Please request a new reset link.', true);
      submit.disabled = false;
      submit.classList.remove('is-loading');
      submitLabel.textContent = 'Update Password';
    } finally {
      clearPasswords();
      newPassword = '';
      submitting = false;
    }
  });

  function startRequestCooldown() {
    requestCooldownUntil = Date.now() + 60000;
    global.clearInterval(requestTimer);
    requestTimer = global.setInterval(function () {
      const remaining = Math.ceil((requestCooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        global.clearInterval(requestTimer);
        requestAnother.disabled = false;
        requestAnother.textContent = 'Send a Password-Reset Email Instead';
      } else requestAnother.textContent = 'Try again in ' + remaining + 's';
    }, 1000);
  }
  requestAnother.addEventListener('click', async function () {
    if (!authorized || !recoveryEmail || Date.now() < requestCooldownUntil) return;
    requestAnother.disabled = true;
    requestAnother.textContent = 'Sending reset link...';
    let rateLimited = false;
    try {
      const result = await supabase.auth.resetPasswordForEmail(recoveryEmail, { redirectTo: auth.passwordResetUrl() });
      rateLimited = Boolean(result.error && /rate|too many|security purposes/i.test(result.error.message || ''));
    } catch (_error) {}
    showStatus(rateLimited ? 'Please wait before requesting another password reset email.' : 'If an account exists for this email address, a password reset link has been sent.', rateLimited);
    startRequestCooldown();
  });

  supabase.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryEventReceived = true;
      authorize(session, false);
      return;
    }
    if (event === 'INITIAL_SESSION' && !initialized) {
      initialized = true;
      if (changeMode) authorize(session, true);
      else if (!recoveryEventReceived) rejectSession();
    }
  });
}(window));
