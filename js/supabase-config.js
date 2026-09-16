(function configureZyntraSupabase(global) {
  'use strict';

  // Frontend-safe project settings. Never put a service_role key in this file.
  const SUPABASE_URL = "https://mdtzjtirfzpimwwbfczk.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Ay78D_983Nz34vIG2KQGyg_q1oAfiqX";
  // Cloudflare Turnstile site keys are public. Keep the secret key only in
  // Supabase Edge Function secrets as TURNSTILE_SECRET_KEY.
  const TURNSTILE_SITE_KEY = "PASTE_CLOUDFLARE_TURNSTILE_SITE_KEY";
  let sharedClient = null;

  function validateConfiguration() {
    if (!SUPABASE_URL || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) ||
        !SUPABASE_PUBLISHABLE_KEY || !/^sb_publishable_/i.test(SUPABASE_PUBLISHABLE_KEY)) {
      throw new Error('Supabase configuration is missing or invalid.');
    }
  }

  function getClient() {
    if (sharedClient) return sharedClient;
    validateConfiguration();
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('The Supabase library could not be loaded. Check your network connection.');
    }
    sharedClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
    });
    return sharedClient;
  }

  global.ZyntraSupabase = Object.freeze({
    SUPABASE_URL: "https://mdtzjtirfzpimwwbfczk.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_Ay78D_983Nz34vIG2KQGyg_q1oAfiqX",
    TURNSTILE_SITE_KEY: TURNSTILE_SITE_KEY,
    getClient: getClient
  });
}(window));
