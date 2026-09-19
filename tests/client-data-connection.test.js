'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/client-portal-setup.sql', 'utf8');
const admin = fs.readFileSync('js/admin-client-portal.js', 'utf8');
const client = fs.readFileSync('js/client-portal.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/manage-client-profile/index.ts', 'utf8');
const portalHtml = fs.readFileSync('client-portal.html', 'utf8');

assert.match(sql, /client_login_ids_profile_fk[\s\S]*references public\.profiles\(id\)/i, 'Client IDs must reference the canonical profile UUID');
assert.match(sql, /create or replace function public\.admin_update_client_profile[\s\S]*security definer[\s\S]*public\.is_portal_admin\(\)/i, 'Admin update must be protected server-side');
assert.match(sql, /revoke execute on function public\.set_my_client_login_id\(text\) from authenticated/i, 'Clients must not change their own Client ID');
assert.match(sql, /old_mapping\.login_id is distinct from updated_mapping\.login_id[\s\S]*Client ID changed/i, 'Client ID changes must be audited');
assert.match(sql, /information_schema\.columns[\s\S]*column_name='client_id'[\s\S]*insert into public\.client_login_ids/i, 'Legacy Client IDs must be migrated safely');

assert.match(edge, /admin\.auth\.admin\.listUsers/, 'Protected server code must resolve Auth emails');
assert.match(edge, /caller\.rpc\('admin_update_client_profile'/, 'Admin updates must use the atomic database function');
assert.doesNotMatch(edge, /reply\([^\n]*serviceRoleKey|body[^\n]*SUPABASE_SERVICE_ROLE_KEY/i, 'Service role credentials must never be returned');

assert.match(admin, /action:'update',userId:record\.id/, 'Admin updates must target the Auth/profile UUID');
assert.match(admin, /profile\.email/, 'Admin Clients table must display the Auth email');
assert.match(admin, /profile\.client_id/, 'Admin Clients table must display the canonical Client ID');
assert.doesNotMatch(client, /set_my_client_login_id/, 'The client portal must not expose Client ID mutation');
assert.doesNotMatch(portalHtml, /id="client-id-form"/, 'The client portal must show Client ID read-only');
assert.match(portalHtml, /id="account-email"[\s\S]*id="account-client-id"/, 'Secure account information must include email and Client ID');

console.log('Canonical client data connection tests: PASS');
