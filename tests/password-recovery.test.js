'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const login = fs.readFileSync('js/login.js', 'utf8');
const reset = fs.readFileSync('js/password-reset.js', 'utf8');
const auth = fs.readFileSync('js/client-auth.js', 'utf8');
const registration = fs.readFileSync('js/client-register.js', 'utf8');
const registrationEdge = fs.readFileSync('supabase/functions/register-client/index.ts', 'utf8');
const admin = fs.readFileSync('js/admin-client-portal.js', 'utf8');
const profileEdge = fs.readFileSync('supabase/functions/manage-client-profile/index.ts', 'utf8');
const sql = fs.readFileSync('supabase/client-portal-setup.sql', 'utf8');
const resetHtml = fs.readFileSync('client/reset-password/index.html', 'utf8');
const loginHtml = fs.readFileSync('client-login.html', 'utf8');
const resetCss = fs.readFileSync('css/client-portal.css', 'utf8');

assert.match(loginHtml, /Password<\/span>[\s\S]*Forgot Password\?/, 'Forgot Password must appear immediately after the client password field');
assert.match(loginHtml, /Reset Your Password[\s\S]*Enter the email address connected to your Zyntra Studio client account\. We will send you a secure password reset link\./, 'Client reset form must use the required privacy-safe copy');
assert.match(login, /resetPasswordForEmail\(email,\s*\{\s*redirectTo:\s*auth\.passwordResetUrl\(\)/, 'Login must use the official recovery-email API and verified redirect');
assert.match(login, /If an account exists for this email address, a password reset link has been sent\./, 'Forgot-password response must not enumerate accounts');
assert.match(login, /resetCooldownUntil[\s\S]*60000/, 'Forgot-password requests must have a client-side cooldown');
assert.match(login, /resetRequesting \|\|[\s\S]*resetRequesting = true/, 'Forgot-password form must block duplicate in-flight requests');

assert.match(reset, /event === 'PASSWORD_RECOVERY'/, 'Recovery access must require the Supabase recovery event');
assert.match(reset, /auth\.getProfile\(session\.user\.id\)/, 'Recovery access must verify the canonical client profile');
assert.match(reset, /supabase\.auth\.updateUser\(\{ password: newPassword \}\)/, 'Passwords must be changed through Supabase Auth');
assert.match(reset, /signOut\(\{ scope: 'others' \}\)/, 'Other Supabase sessions must be revoked');
assert.match(reset, /history\.replaceState/, 'Sensitive recovery URL values must be removed');
assert.doesNotMatch(reset, /localStorage|sessionStorage/, 'Passwords and recovery data must not be stored in browser storage');
assert.match(resetHtml, /id="secure-new-password"[\s\S]*id="secure-confirm-password"/, 'Reset page must collect and confirm the new password');
assert.match(resetCss, /cp-password-strength/, 'Reset page must include password-strength styling');

assert.match(sql, /after update of encrypted_password on auth\.users[\s\S]*handle_portal_password_changed/, 'Forced-change status must clear only after Auth changes the password hash');
assert.match(sql, /revoke insert,update,delete on public\.profiles from authenticated/, 'Clients must not mutate protected profile fields');
assert.match(auth, /profile\.must_change_password === true[\s\S]*clientPasswordReset/, 'Protected client routes must enforce the first-login password change');

assert.match(registration, /functions\.invoke\('register-client'/, 'Registration must use the protected direct-registration function');
assert.match(registrationEdge, /auth\.admin\.createUser\(\{[\s\S]*password[\s\S]*email_confirm:\s*true/, 'Admin registration must directly create a confirmed Auth user with a temporary password');
assert.doesNotMatch(registrationEdge, /inviteUserByEmail|invite-client/i, 'Direct registration must never use invitations');
assert.match(admin, /Send Password Reset/, 'Admin client records must expose the reset action');
assert.match(profileEdge, /callerProfile\.data\?\.role !== 'admin'/, 'Admin reset action must be protected server-side');
assert.match(profileEdge, /resetPasswordForEmail\(email,\s*\{\s*redirectTo:/, 'Admin reset action must use the registered Auth email');
assert.doesNotMatch(profileEdge, /token_hash|access_token|refresh_token/, 'Admin reset responses and logs must not expose recovery tokens');

const browserSources = [login, reset, auth, registration, admin].join('\n');
assert.doesNotMatch(browserSources, /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/, 'Browser code must not contain a service-role credential');
assert.equal(fs.existsSync('supabase/functions/invite-client/index.ts'), false, 'The old invitation function must remain removed');

console.log('Password recovery and direct-registration contract tests: PASS');
