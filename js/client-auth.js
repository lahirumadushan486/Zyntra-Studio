(function configureClientAuth(global) {
  'use strict';

  const loginUrl = 'client-login.html';

  function client() {
    return global.ZyntraSupabase.getClient();
  }

  function safeMessage(error, fallback) {
    if (!error) return fallback;
    if (/invalid login credentials/i.test(error.message || '')) return 'The email or password is incorrect.';
    if (/email not confirmed/i.test(error.message || '')) return 'Please confirm your email before signing in.';
    if (/rate limit/i.test(error.message || '')) return 'Too many attempts. Please wait and try again.';
    return fallback;
  }

  async function getProfile(userId) {
    const result = await client().from('profiles').select('id,full_name,business_name,phone,avatar_url,role,active,created_at,updated_at').eq('id', userId).maybeSingle();
    if (result.error) throw new Error('Your portal profile could not be loaded.');
    return result.data;
  }

  async function routeForSession(session) {
    if (!session || !session.user) return null;
    const profile = await getProfile(session.user.id);
    if (!profile || !profile.active) {
      await client().auth.signOut();
      throw new Error('This portal account is unavailable. Contact Zyntra Studio.');
    }
    return profile.role === 'admin' ? 'admin.html' : 'client-portal.html';
  }

  async function requireAccess(requiredRole) {
    const sessionResult = await client().auth.getSession();
    const session = sessionResult.data.session;
    if (!session) {
      global.location.replace(loginUrl);
      return null;
    }
    let profile;
    try {
      profile = await getProfile(session.user.id);
    } catch (error) {
      global.location.replace(loginUrl + '?error=profile');
      return null;
    }
    if (!profile || !profile.active) {
      await client().auth.signOut();
      global.location.replace(loginUrl + '?error=inactive');
      return null;
    }
    if (profile.role !== requiredRole) {
      global.location.replace(profile.role === 'admin' ? 'admin.html' : 'client-portal.html');
      return null;
    }
    return { session: session, user: session.user, profile: profile };
  }

  function watchProtectedSession() {
    return client().auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) global.location.replace(loginUrl);
    });
  }

  async function logout() {
    await client().auth.signOut();
    global.location.replace(loginUrl);
  }

  global.ZyntraClientAuth = Object.freeze({
    client: client,
    getProfile: getProfile,
    routeForSession: routeForSession,
    requireAccess: requireAccess,
    watchProtectedSession: watchProtectedSession,
    logout: logout,
    safeMessage: safeMessage
  });
}(window));
