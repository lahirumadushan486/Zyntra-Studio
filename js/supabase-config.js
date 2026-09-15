(function configureZyntraSupabase(global) {
  'use strict';

  const config = Object.freeze({
    url: 'https://mdtzjtirfzpimwwbfczk.supabase.co',
    publishableKey: 'sb_publishable_Ay78D_983Nz34vIG2KQGyg_q1oAfiqX'
  });
  let client = null;

  function getClient() {
    if (client) return client;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('The secure portal connection could not be initialized.');
    }
    client = global.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  global.ZyntraSupabase = Object.freeze({ config: config, getClient: getClient });
}(window));
