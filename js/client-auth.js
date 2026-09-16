(function configureClientAuth(global) {
  'use strict';

  const routes = Object.freeze({
    clientLogin: 'client-login.html',
    adminLogin: 'admin-login.html',
    clientDashboard: 'client-portal.html',
    adminDashboard: 'admin-dashboard.html'
  });

  class PortalAuthError extends Error {
    constructor(code, message, cause, actualRole) {
      super(message);
      this.name = 'PortalAuthError';
      this.code = code;
      this.cause = cause || null;
      this.actualRole = actualRole || null;
    }
  }

  function client() {
    if (!global.ZyntraSupabase) throw new PortalAuthError('configuration', 'Supabase configuration is missing.');
    return global.ZyntraSupabase.getClient();
  }

  function normalizeRole(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function safeMessage(error, fallback) {
    const message = String(error && error.message || error || '');
    if (error instanceof PortalAuthError) return error.message;
    if (/invalid login credentials/i.test(message)) return 'The email or password is incorrect.';
    if (/email not confirmed/i.test(message)) return 'Please confirm your email before signing in.';
    if (/rate limit|too many requests/i.test(message)) return 'Too many attempts. Please wait and try again.';
    if (/session.*(expired|missing)|jwt.*expired|refresh_token/i.test(message)) return 'Your session has expired. Please sign in again.';
    if (/fetch|network|connection|offline|failed to fetch|timeout/i.test(message)) return 'A network connection error occurred. Check your connection and try again.';
    return fallback || 'Something went wrong. Please try again.';
  }

  async function signOutQuietly() {
    if (global.ZyntraPortalSession) global.ZyntraPortalSession.clearPortalSessionTimeout();
    try { await client().auth.signOut(); }
    catch (error) {
      try { await client().auth.signOut({ scope: 'local' }); } catch (localError) { /* best effort local cleanup */ }
    }
  }

  async function getProfile(userId) {
    let result;
    try {
      result = await client().from('profiles')
        .select('id,full_name,business_name,phone,role,active,created_at,updated_at')
        .eq('id', userId)
        .single();
    } catch (error) {
      throw new PortalAuthError('profile_error', 'We could not verify your portal access. Please try again.', error);
    }
    if (result.error) {
      if (result.error.code === 'PGRST116') {
        throw new PortalAuthError('profile_missing', 'Your portal profile has not been created. Contact Zyntra Studio.', result.error);
      }
      throw new PortalAuthError('profile_error', 'We could not verify your portal access. Please try again.', result.error);
    }
    if (!result.data || result.data.id !== userId) {
      throw new PortalAuthError('profile_missing', 'Your portal profile has not been created. Contact Zyntra Studio.');
    }
    return result.data;
  }

  async function validateSessionForRole(session, requiredRole) {
    const normalizedRequiredRole = normalizeRole(requiredRole);
    if (!['admin', 'client'].includes(normalizedRequiredRole)) {
      await signOutQuietly();
      throw new PortalAuthError('role_invalid', 'We could not verify your portal access. Please try again.');
    }
    if (!session || !session.user || !session.user.id || !session.access_token) {
      await signOutQuietly();
      throw new PortalAuthError('session_missing', 'Your session has expired. Please sign in again.');
    }

    let profile;
    try { profile = await getProfile(session.user.id); }
    catch (error) { await signOutQuietly(); throw error; }

    const actualRole = normalizeRole(profile.role);
    if (profile.active !== true) {
      await signOutQuietly();
      throw new PortalAuthError('inactive', 'This account is inactive. Contact Zyntra Studio.', null, actualRole);
    }
    if (!['admin', 'client'].includes(actualRole)) {
      await signOutQuietly();
      throw new PortalAuthError('role_invalid', 'We could not verify your portal access. Please try again.', null, actualRole);
    }
    if (actualRole !== normalizedRequiredRole) {
      await signOutQuietly();
      const message = normalizedRequiredRole === 'client'
        ? 'Please use the Admin Login page.'
        : 'This account does not have Admin access.';
      throw new PortalAuthError('wrong_role', message, null, actualRole);
    }

    profile.role = actualRole;
    return profile;
  }

  function loginForRole(role) {
    return normalizeRole(role) === 'admin' ? routes.adminLogin : routes.clientLogin;
  }

  async function requireAccess(requiredRole) {
    const role = normalizeRole(requiredRole);
    let result;
    try { result = await client().auth.getSession(); }
    catch (error) {
      await signOutQuietly();
      global.location.replace(loginForRole(role) + '?error=session');
      return null;
    }
    if (result.error || !result.data.session) {
      if (global.ZyntraPortalSession) global.ZyntraPortalSession.clearPortalSessionTimeout();
      if (result.error) await signOutQuietly();
      global.location.replace(loginForRole(role) + (result.error ? '?error=session' : ''));
      return null;
    }

    if (global.ZyntraPortalSession) {
      const timedSession = await global.ZyntraPortalSession.validatePortalSession({ supabase: client(), role: role });
      if (!timedSession) return null;
    }

    try {
      const profile = await validateSessionForRole(result.data.session, role);
      return { session: result.data.session, user: result.data.session.user, profile: profile };
    } catch (error) {
      const code = error.code === 'wrong_role' || error.code === 'role_invalid' ? 'wrong-role' : error.code;
      global.location.replace(loginForRole(role) + '?error=' + encodeURIComponent(code || 'session'));
      return null;
    }
  }

  function watchProtectedSession(requiredRole) {
    return client().auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        if (global.ZyntraPortalSession && !global.ZyntraPortalSession.readExpiry()) return;
        if (global.ZyntraPortalSession) global.ZyntraPortalSession.clearPortalSessionTimeout();
        global.location.replace(loginForRole(requiredRole));
      }
    });
  }

  async function logout(role) {
    if (global.ZyntraPortalSession) {
      await global.ZyntraPortalSession.performPortalLogout({ reason: 'manual' });
      return;
    }
    const result = await client().auth.signOut();
    if (result.error) throw new PortalAuthError('logout', safeMessage(result.error, 'Logout failed. Please try again.'), result.error);
    global.location.replace(loginForRole(role));
  }

  global.ZyntraClientAuth = Object.freeze({
    PortalAuthError: PortalAuthError,
    routes: routes,
    client: client,
    getProfile: getProfile,
    validateSessionForRole: validateSessionForRole,
    requireAccess: requireAccess,
    watchProtectedSession: watchProtectedSession,
    logout: logout,
    safeMessage: safeMessage
  });
}(window));
