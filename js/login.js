(function initializePortalLogin(global) {
  'use strict';

  const entryRole = document.body.dataset.loginRole === 'admin' ? 'admin' : 'client';
  const form = document.getElementById('portal-login-form');
  const resetForm = document.getElementById('password-reset-form');
  const status = document.getElementById('login-status');
  const resetStatus = document.getElementById('reset-status');
  const submit = document.getElementById('login-submit');
  const password = document.getElementById('login-password');
  let auth;
  let supabase;
  let recoveryMode = /(?:#|[?&])type=recovery(?:&|$)/.test(global.location.href);
  let routing = false;

  function showStatus(target, message, isError) {
    target.textContent = message || '';
    target.classList.toggle('is-error', Boolean(isError));
  }

  function setLoading(value) {
    submit.disabled = value;
    submit.classList.toggle('is-loading', value);
    submit.querySelector('[data-button-label]').textContent = value ? 'Signing In…' : 'Sign In';
  }

  function showRecovery() {
    recoveryMode = true;
    form.hidden = true;
    resetForm.hidden = false;
    document.getElementById('new-password').focus();
  }

  async function routeSession(session) {
    if (recoveryMode || routing || !session) return;
    routing = true;
    try {
      const destination = await auth.routeForSession(session);
      if (entryRole === 'admin' && destination === auth.routes.clientDashboard) {
        showStatus(status, 'Client accounts cannot access the Admin Dashboard. Redirecting to the Client Portal…', true);
      }
      global.location.replace(destination);
    } catch (error) {
      showStatus(status, auth.safeMessage(error, 'Sign in failed. Please try again.'), true);
      setLoading(false);
      routing = false;
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

  document.getElementById('toggle-password').addEventListener('click', function () {
    const reveal = password.type === 'password';
    password.type = reveal ? 'text' : 'password';
    this.textContent = reveal ? 'Hide' : 'Show';
    this.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    showStatus(status, '', false);
    if (!form.reportValidity()) return;
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({
      email: document.getElementById('login-email').value.trim(), password: password.value
    });
    if (result.error) {
      showStatus(status, auth.safeMessage(result.error, 'Sign in failed. Please try again.'), true);
      setLoading(false);
      return;
    }
    await routeSession(result.data.session);
  });

  document.getElementById('forgot-password').addEventListener('click', async function () {
    const email = document.getElementById('login-email');
    if (!email.value.trim() || !email.checkValidity()) {
      showStatus(status, 'Enter a valid account email first.', true);
      email.focus();
      return;
    }
    this.disabled = true;
    const result = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: 'https://zyntrastudio.lk/client-login.html'
    });
    showStatus(status, result.error ? auth.safeMessage(result.error, 'The password reset email could not be sent.') : 'If an account matches that email, password reset instructions have been sent.', Boolean(result.error));
    this.disabled = false;
  });

  resetForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const next = document.getElementById('new-password');
    const confirmation = document.getElementById('confirm-password');
    const resetSubmit = document.getElementById('reset-submit');
    showStatus(resetStatus, '', false);
    if (!resetForm.reportValidity()) return;
    if (next.value !== confirmation.value) {
      showStatus(resetStatus, 'The passwords do not match.', true);
      confirmation.focus();
      return;
    }
    resetSubmit.disabled = true;
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error || !sessionResult.data.session) {
      showStatus(resetStatus, 'This password reset link is invalid or has expired. Request a new one.', true);
      resetSubmit.disabled = false;
      return;
    }
    const result = await supabase.auth.updateUser({ password: next.value });
    if (result.error) {
      showStatus(resetStatus, auth.safeMessage(result.error, 'Your password could not be updated. Request a new reset link.'), true);
      resetSubmit.disabled = false;
      return;
    }
    recoveryMode = false;
    showStatus(resetStatus, 'Password updated. Redirecting to your portal…', false);
    await routeSession(sessionResult.data.session);
  });

  supabase.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') { showRecovery(); return; }
    if (event === 'SIGNED_IN' && session && !recoveryMode) global.setTimeout(function () { routeSession(session); }, 0);
  });

  const code = new URLSearchParams(global.location.search).get('error');
  const messages = {
    'auth-required': 'Please sign in to continue.', session: 'Your session has expired. Please sign in again.',
    session_missing: 'Your session has expired. Please sign in again.',
    profile_missing: 'Your portal profile has not been created. Contact Zyntra Studio.',
    inactive: 'This account is inactive. Contact Zyntra Studio.',
    role_invalid: 'Your account role is not authorized. Contact Zyntra Studio.'
  };
  if (code) showStatus(status, messages[code] || 'Please sign in again to continue.', true);
  if (recoveryMode) showRecovery();

  supabase.auth.getSession().then(function (result) {
    if (result.error) showStatus(status, auth.safeMessage(result.error, 'Your saved session could not be restored.'), true);
    else if (result.data.session && !recoveryMode) routeSession(result.data.session);
  }).catch(function (error) {
    showStatus(status, auth.safeMessage(error, 'Your saved session could not be restored.'), true);
  });
}(window));
