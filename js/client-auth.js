(function configureClientAuth(global) {
  'use strict';

  const routes = Object.freeze({
    clientLogin: '/portal/login', adminLogin: '/admin/login',
    clientDashboard: '/client-portal', adminDashboard: '/admin'
  });

  class PortalAuthError extends Error {
    constructor(code, message, cause) { super(message); this.name = 'PortalAuthError'; this.code = code; this.cause = cause || null; }
  }

  function client() {
    if (!global.ZyntraSupabase) throw new PortalAuthError('configuration', 'Supabase configuration is missing.');
    return global.ZyntraSupabase.getClient();
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

  async function getProfile(userId) {
    let result;
    try {
      result = await client().from('profiles').select('id,full_name,business_name,phone,role,active,created_at,updated_at').eq('id', userId).maybeSingle();
    } catch (error) {
      throw new PortalAuthError('profile_network', safeMessage(error, 'The profile service could not be reached.'), error);
    }
    if (result.error) throw new PortalAuthError('profile_error', safeMessage(result.error, 'Your portal profile could not be loaded: ' + result.error.message), result.error);
    if (!result.data) throw new PortalAuthError('profile_missing', 'Your portal profile has not been created. Contact Zyntra Studio.');
    return result.data;
  }

  async function signOutQuietly() { try { await client().auth.signOut(); } catch (error) { /* best effort */ } }

  async function verifySession(session) {
    if (!session || !session.user || !session.access_token) throw new PortalAuthError('session_missing', 'Your session has expired. Please sign in again.');
    let profile;
    try { profile = await getProfile(session.user.id); }
    catch (error) { if (error.code === 'profile_missing') await signOutQuietly(); throw error; }
    if (!profile.active) { await signOutQuietly(); throw new PortalAuthError('inactive', 'This account is inactive. Contact Zyntra Studio.'); }
    if (!['admin', 'client'].includes(profile.role)) { await signOutQuietly(); throw new PortalAuthError('role_invalid', 'Your account role is not authorized. Contact Zyntra Studio.'); }
    return { session: session, user: session.user, profile: profile };
  }

  async function routeForSession(session) {
    const context = await verifySession(session);
    return context.profile.role === 'admin' ? routes.adminDashboard : routes.clientDashboard;
  }

  function loginForRole(role) { return role === 'admin' ? routes.adminLogin : routes.clientLogin; }

  async function requireAccess(requiredRole) {
    let result;
    try { result = await client().auth.getSession(); }
    catch (error) { throw new PortalAuthError('session_error', safeMessage(error, 'Your session could not be checked.'), error); }
    if (result.error || !result.data.session) {
      if (result.error) await signOutQuietly();
      global.location.replace(loginForRole(requiredRole) + '?error=' + (result.error ? 'session' : 'auth-required'));
      return null;
    }
    try {
      const context = await verifySession(result.data.session);
      if (context.profile.role !== requiredRole) {
        global.location.replace(context.profile.role === 'admin' ? routes.adminDashboard : routes.clientDashboard);
        return null;
      }
      return context;
    } catch (error) {
      if (['inactive', 'profile_missing', 'role_invalid', 'session_missing'].includes(error.code)) {
        await signOutQuietly();
        global.location.replace(loginForRole(requiredRole) + '?error=' + encodeURIComponent(error.code));
        return null;
      }
      throw error;
    }
  }

  function watchProtectedSession(requiredRole) {
    return client().auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) global.location.replace(loginForRole(requiredRole));
    });
  }

  async function logout(role) {
    const result = await client().auth.signOut();
    if (result.error) throw new PortalAuthError('logout', safeMessage(result.error, 'Logout failed. Please try again.'), result.error);
    global.location.replace(loginForRole(role));
  }

  global.ZyntraClientAuth = Object.freeze({
    PortalAuthError: PortalAuthError, routes: routes, client: client, getProfile: getProfile,
    verifySession: verifySession, routeForSession: routeForSession, requireAccess: requireAccess,
    watchProtectedSession: watchProtectedSession, logout: logout, safeMessage: safeMessage
  });
}(window));
