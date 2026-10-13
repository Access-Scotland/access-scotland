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

Upstash settings in `.env.example` are optional. Without them, rate limits use
the Netlify Function instance's in-memory store, while Turnstile and the
honeypot still protect the form.

Do not add the optional Upstash or `CONTACT_*` tuning variables to Netlify
unless they are intentionally being configured. The defaults in the contact
handler are appropriate for the initial small-traffic deployment.

## Current notes

- The gallery is currently powered by static data in `src/siteData.js`.
- `Second Mission Trip` still links to the live archive while that album import is unfinished.
- The contact form is implemented and needs the production Resend and Turnstile environment values before launch.
- A future admin/photo-management flow can be layered in without rebuilding the front end structure.
