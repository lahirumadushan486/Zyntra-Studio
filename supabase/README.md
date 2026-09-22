# Zyntra Studio portal setup

1. In **Supabase Dashboard → Authentication → Users**, create the initial
   administrator Auth user. Create or reset that password through Supabase
   Authentication. Never place a password or service-role key in this website.
2. Run the complete `client-portal-setup.sql` file in **SQL Editor**. It is
   idempotent and promotes the configured existing Auth user to administrator.
3. In **Authentication → URL Configuration**, set:

   - Site URL: `https://zyntrastudio.lk`
   - Redirect URLs:
     - `https://zyntrastudio.lk/client/reset-password/`
     - `https://www.zyntrastudio.lk/client/reset-password/`
     - `http://localhost:5500/client/reset-password/`
     - `http://127.0.0.1:5500/client/reset-password/`

   Add only exact preview deployment URLs controlled by Zyntra Studio. Avoid a
   broad production wildcard when an exact callback URL can be used.
4. In **Authentication → Providers → Email**, keep password authentication
   enabled. Client accounts are created directly by an authenticated admin with
   a temporary password. The application does not send invitation emails and
   does not provide public client self-registration.

The recovery callback is `https://zyntrastudio.lk/client/reset-password/`.
That page enables password changes only after Supabase emits
`PASSWORD_RECOVERY` and the client session is validated. First-login changes
use the same page with an authenticated client profile whose protected
`must_change_password` field is true.

## Website routes

The `.html` URLs remain available as fallbacks. Configure these rewrites when
the production host supports clean URLs:

```text
/portal                  -> /portal-access.html
/portal/login            -> /client-login.html
/portal/register         -> /client-register.html
/client-portal           -> /client-portal.html
/client/reset-password   -> /client/reset-password/index.html
/admin/login             -> /admin-login.html
/admin                   -> /admin-dashboard.html
```

## Edge Functions

Install the Supabase CLI, link the project, and deploy:

```text
supabase login
supabase link --project-ref mdtzjtirfzpimwwbfczk
supabase functions deploy manage-client-login-id
supabase functions deploy manage-client-profile
supabase functions deploy login-with-client-id --no-verify-jwt
supabase functions deploy register-client
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The service-role key must never
appear in browser code.

Only `login-with-client-id` disables gateway JWT verification because logged-out
clients call it; that function performs its own origin, CAPTCHA and rate-limit
checks. `register-client` independently verifies an active administrator and
creates a confirmed Auth user directly. The reset page changes the password with
the signed-in user's Supabase Auth session. A database trigger clears
`must_change_password` only after Auth writes a different password hash, and the
browser then revokes the user's other sessions. `manage-client-profile` protects
the admin reset action and never returns a recovery URL or token.

After changing the SQL file, run the entire file again. The Auth trigger always
creates a `client` profile and never trusts metadata for a role. Clients cannot
update `role`, `active`, or `must_change_password` through normal profile
requests.

## CAPTCHA

Cloudflare Turnstile protects logged-out Client ID login. Configure its public
site key in `js/supabase-config.js` and keep `TURNSTILE_SECRET_KEY` only in
Supabase Edge Function secrets:

```text
supabase secrets set TURNSTILE_SECRET_KEY=your_private_turnstile_secret
```

## Password-recovery email

In **Authentication → Email Templates → Reset password**, set the subject:

```text
Reset Your Zyntra Studio Client Portal Password
```

Use a branded HTML template with `{{ .ConfirmationURL }}` only as the button
destination:

```html
<h2>Reset Your Zyntra Studio Client Portal Password</h2>
<p>Hello,</p>
<p>We received a request to reset the password for your Zyntra Studio Client Portal account.</p>
<p>Use the secure button below to create a new password.</p>
<p><a href="{{ .ConfirmationURL }}">Reset My Password</a></p>
<p>If you did not request this change, you can safely ignore this email.</p>
<p>For your security, do not share this password-reset link with anyone.</p>
<p>Zyntra Studio<br>Call / WhatsApp: 070 600 4033</p>
```

Supabase's default sender is suitable only for limited testing and is heavily
rate-limited. Configure a verified custom SMTP provider and sender before
production. Store SMTP credentials only in Supabase project configuration.
Review the Auth email rate limit as well; the UI adds a 60-second cooldown, but
Supabase remains the server-side enforcement layer. Disable provider email
tracking because rewritten recovery links can break authentication.

## Required verification

After deploying the SQL and functions, use separate real test admin and client
accounts to verify:

- direct admin registration sends no invitation email;
- the temporary password works with email and Client ID login;
- first login cannot enter the portal before a secure password change;
- recovery responses do not disclose account existence;
- recovery links reject invalid, expired and reused tokens;
- strong-password and confirmation checks work;
- the old password stops working and the new password works for both login methods;
- admin reset requests require an active admin and respect rate limits;
- clients cannot alter security fields or call protected admin actions;
- no password, service-role key, or recovery token appears in tables, storage or logs;
- desktop and mobile layouts remain usable;
- the fixed 15-minute portal timeout still expires as expected.

## Fixed portal session duration

`js/portal-session-timeout.js` enforces a fixed application session ending 15
minutes after a successful role-verified login. Refreshes, navigation, activity
and Supabase token refreshes do not extend it. Only a non-secret expiry timestamp
is stored in browser storage; Supabase manages access and refresh tokens.

`auth.users.id` remains the canonical identity for profiles, Client IDs and
portal data. The admin editor uses protected functions for profile, account and
Client ID changes. Existing projects, payments, drafts, revisions and
deliverables retain their current RLS policies and storage rules.
