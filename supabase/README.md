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

The reset email returns to `https://zyntrastudio.lk/client-login.html`. The
page detects Supabase's `PASSWORD_RECOVERY` event before performing normal role
routing, then displays the new-password form.

## Website routes

The `.html` URLs always work as direct fallbacks. If the production host
supports clean-URL rewrites, configure these server-side rules:

```text
/portal        -> /portal-access.html
/portal/login  -> /client-login.html
/client-portal -> /client-portal.html
/admin/login   -> /admin-login.html
/admin         -> /admin-dashboard.html
```

No hosting platform configuration was present in this repository, so no
platform-specific rewrite file was added. Static directory-index fallback files
are included for every clean route, while the original `.html` pages continue
to work directly. If the host supports rewrites, the rules above may be added
in its control panel to avoid the lightweight fallback redirect.
