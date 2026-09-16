# Zyntra Studio portal setup

1. In **Supabase Dashboard → Authentication → Users**, create or invite
   `lahirumadushan486@gmail.com`. Create or reset its password through Supabase
   Authentication. Never place that password, or the `service_role` key, in this
   website.
2. Open **SQL Editor**, paste the complete contents of
   `client-portal-setup.sql`, and run it. The script is idempotent and promotes
   the existing Auth user above to the active Zyntra Studio administrator.
3. In **Authentication → URL Configuration**, set:

   - Site URL: `https://zyntrastudio.lk`
   - Redirect URLs:
     - `https://zyntrastudio.lk/**`
     - `https://www.zyntrastudio.lk/**`
     - `http://localhost:5500/**`
     - `http://127.0.0.1:5500/**`

4. In **Authentication → Providers → Email**, keep Email sign-ups enabled.
   Enable **Confirm email** when clients must verify ownership before their
   first login. Registration supports both confirmation-required and
   immediate-session configurations.

The reset email returns to `https://zyntrastudio.lk/client-login.html`. The
page detects Supabase's `PASSWORD_RECOVERY` event before performing normal role
routing, then displays the new-password form.

## Website routes

The `.html` URLs always work as direct fallbacks. If the production host
supports clean-URL rewrites, configure these server-side rules:

```text
/portal        -> /portal-access.html
/portal/login  -> /client-login.html
/portal/register -> /client-register.html
/client-portal -> /client-portal.html
/admin/login   -> /admin-login.html
/admin         -> /admin-dashboard.html
```

No hosting platform configuration was present in this repository, so no
platform-specific rewrite file was added. Static directory-index fallback files
are included for every clean route, while the original `.html` pages continue
to work directly. If the host supports rewrites, the rules above may be added
in its control panel to avoid the lightweight fallback redirect.

## Configure CAPTCHA and deploy Edge Functions

Create a Cloudflare Turnstile widget for these hostnames:

- `zyntrastudio.lk`
- `www.zyntrastudio.lk`
- `localhost` (development only)

Replace `PASTE_CLOUDFLARE_TURNSTILE_SITE_KEY` in
`js/supabase-config.js` with the public Turnstile site key. Store the private
secret only in the Supabase Edge Function environment:

```text
supabase secrets set TURNSTILE_SECRET_KEY=your_private_turnstile_secret
```

Do not add the Turnstile secret or the Supabase service-role key to HTML or
browser JavaScript.

Deploy all protected and public authentication functions:

Install the Supabase CLI, authenticate, and deploy the protected function:

```text
supabase login
supabase link --project-ref mdtzjtirfzpimwwbfczk
supabase functions deploy invite-client
supabase functions deploy manage-client-login-id
supabase functions deploy login-with-client-id --no-verify-jwt
supabase functions deploy register-client --no-verify-jwt
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to the Edge Function environment. The service-role
key must remain there and must never be copied into HTML or browser JavaScript.
The two public functions deliberately disable the gateway JWT requirement
because logged-out users call them. They enforce exact Origin allow-lists,
JSON-only requests, Turnstile verification and persistent database rate
limiting themselves. `manage-client-login-id` and `invite-client` retain JWT
verification and independently verify an active `profiles.role = 'admin'`.

After updating the SQL function in `client-portal-setup.sql`, run the complete
SQL file again in the Supabase SQL Editor. It is idempotent. The Auth trigger
always creates public registrations as active `client` profiles and never reads
a role from user metadata. An optional requested Client ID is normalized and
reserved by that server-side trigger; it becomes active only after the owner
has a confirmed authenticated client session.

## Required verification

After deployment, test in a private browser window using real test client and
admin Auth users. Confirm email-only registration, optional Client ID
registration, duplicate rejection, uppercase normalization, both client login
methods, role rejection on the opposite login, inactive profile and ID blocks,
refresh persistence, logout, password recovery, Admin ID add/replace/copy/
disable/reactivate, and mobile layouts. RLS checks should also confirm anon
cannot select `client_login_ids`, a client sees only their own row, and a
client cannot update `profiles.role` or `profiles.active`.

## Fixed portal session duration

`js/portal-session-timeout.js` enforces a fixed application session ending 15
minutes after a successful role-verified login. Refreshes, navigation, user
activity and Supabase token refreshes do not extend it. Only the non-secret
expiry timestamp is stored in browser storage; Supabase continues to manage
its own access and refresh tokens.

Supabase projects also expose an Auth JWT expiry setting. Setting that to 900
seconds can shorten individual access-token lifetimes, but refresh tokens may
still renew them, so it is not a substitute for this fixed application timer.
Review that project-wide setting separately before changing it because it
affects every Supabase-authenticated feature.

The Admin dashboard now loads each module independently. Client ID reads use
admin RLS directly, while all Client ID mutations still require the protected
`manage-client-login-id` function. Run the complete SQL setup again after this
update; its final `notify pgrst, 'reload schema'` refreshes the API schema cache.
