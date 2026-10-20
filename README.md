# Access Scotland

React/Vite rebuild of the Access Scotland website, redesigned from the live Wix site into a mobile-first single-page experience.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The production output is written to `dist/`.

## Netlify

This project is configured for an initial Netlify deploy with `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22.12.0`

## Contact form

The contact form posts to `/api/contact`. A Netlify Function handles field
validation, a hidden honeypot, Cloudflare Turnstile verification, rate limits,
duplicate detection, and delivery through Resend. The same endpoint is
available through the Vite development server.

Copy `.env.example` to `.env` for local testing, then configure the same values
under **Netlify > Site configuration > Environment variables**. Do not commit
real credentials.

Required production values:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
CONTACT_RECIPIENT_EMAILS
VITE_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
TURNSTILE_EXPECTED_ACTION=contact
TURNSTILE_EXPECTED_HOSTNAMES
CONTACT_TURNSTILE_REQUIRED=true
```

`TURNSTILE_EXPECTED_HOSTNAMES` should contain the production Netlify hostname,
`accessscotland.com`, and `www.accessscotland.com`, separated by commas. GoDaddy
can remain the domain registrar and DNS manager; Turnstile does not require
moving DNS to Cloudflare.

Also add the deployed `.netlify.app` hostname to the widget in **Cloudflare >
Turnstile > your widget > Settings > Hostname Management**. Enter only the
hostname, without `https://` or a path. This Cloudflare setting authorizes the
browser widget; `TURNSTILE_EXPECTED_HOSTNAMES` separately checks the hostname
after token validation on the server. Confirm `VITE_TURNSTILE_SITE_KEY` in
Netlify matches that widget's site key, not its secret key. Redeploy after
changing `VITE_TURNSTILE_SITE_KEY` because Vite embeds it during the build.
If the widget displays “Troubleshoot,” the form now shows the Cloudflare error
code: `110200` means the hostname is not authorized, while `110100`, `110110`,
or `400020` indicate a site key problem.

Upstash settings in `.env.example` are optional. Without them, rate limits use
the Netlify Function instance's in-memory store, while Turnstile and the
honeypot still protect the form.

Do not add the optional Upstash or `CONTACT_*` tuning variables to Netlify
unless they are intentionally being configured. The defaults in the contact
handler are appropriate for the initial small-traffic deployment.

## Admin sign in

The `/admin` page uses Netlify Identity for email/password login, invitations,
password recovery, and sign-out. A Netlify Function checks the signed-in user's
`admin` role before returning an admin session. Future photo-management
functions must use the same server-side role check in `src/server/admin-auth.js`.

To enable it on the client's Netlify project:

1. Open **Identity** for the project and select **Enable Identity**.
2. Under **Project configuration > Identity > Registration**, set registration
   to **Invite only**.
3. Under **Identity > Users**, invite each admin by email. These are site
   Identity users, not Netlify team members.
4. Open each user's Identity record and assign the role `admin` (lowercase).
5. Push and deploy this code, then open `/admin`. Invitation and password-reset
   links may land on the home URL; the app routes their tokens to `/admin`.

No new environment variables are needed. A normal `npm run dev` session can
show the admin page, but it cannot authenticate without Netlify Identity's
runtime. Test the full login flow on the deployed Netlify site after enabling
Identity. Role changes take effect on the user's next login or token refresh.

## Current notes

- The gallery is currently powered by static data in `src/siteData.js`.
- `Second Mission Trip` still links to the live archive while that album import is unfinished.
- The contact form is implemented and needs the production Resend and Turnstile environment values before launch.
- A future admin/photo-management flow can be layered in without rebuilding the front end structure.
