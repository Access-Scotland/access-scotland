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

Use a local `.env` for testing, then configure the same values under
**Netlify > Site configuration > Environment variables**. Do not commit real
credentials.

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

Upstash settings are optional. Without them, rate limits use
the Netlify Function instance's in-memory store, while Turnstile and the
honeypot still protect the form.

Do not add the optional Upstash or `CONTACT_*` tuning variables to Netlify
unless they are intentionally being configured. The defaults in the contact
handler are appropriate for the initial small-traffic deployment.

## Admin sign in

The `/admin` page uses Netlify Identity for email/password login, invitations,
password recovery, and sign-out. Netlify Functions check the signed-in user's
`admin` role before showing the editor or publishing changes. Admins can edit
site copy, partner links, contact cards, and gallery descriptions. Images and
album files remain static and cannot be uploaded through the dashboard.
The founder emails in the editor are public display links; the contact form's
delivery addresses remain controlled by `CONTACT_RECIPIENT_EMAILS` in Netlify.

To enable it on the client's Netlify project:

1. Open **Identity** for the project and select **Enable Identity**.
2. Under **Project configuration > Identity > Registration**, set registration
   to **Invite only**.
3. Under **Identity > Users**, invite each admin by email. These are site
   Identity users, not Netlify team members.
4. Open each user's Identity record and assign the role `admin` (lowercase).
5. Push and deploy this code, then open `/admin`. Invitation and password-reset
   links may land on the home URL; the app routes their tokens to `/admin`.

The sign-in itself needs no environment variables. A normal `npm run dev`
session can show the admin page, but it cannot authenticate without Netlify
Identity's runtime. Test the full flow on the deployed Netlify site. Role
changes take effect on the user's next login or token refresh.

### Copy publishing setup

The editor stores its published JSON in a dedicated GitHub branch. Main stays
the Netlify deploy branch, so copy edits survive future code deploys and do
not trigger a site rebuild. The public page reads the JSON through
`/api/content`; if GitHub is unavailable, it falls back to bundled copy.

1. Create a branch named `site-content` from `main` in the client's GitHub
   repository. Do not change Netlify's deploy branch from `main`.
2. Create a GitHub App under the client's GitHub account. Give it **Contents:
   Read and write** repository permission and install it on only the Access
   Scotland repository. OAuth sign-in is not needed; Netlify Identity already
   handles admin authentication.
3. Add these Netlify environment variables for Functions (never prefix them
   with `VITE_`):

   ```text
   GITHUB_APP_CLIENT_ID=the-app-client-id
   GITHUB_APP_PRIVATE_KEY=the-app-private-key-PEM
   GITHUB_CONTENT_REPO_OWNER=the-github-owner
   GITHUB_CONTENT_REPO_NAME=the-repository-name
   GITHUB_CONTENT_BRANCH=site-content
   GITHUB_CONTENT_PATH=content/site-content.json
   ```

4. Trigger a new Netlify deploy to load the Function settings. Sign in at
   `/admin`, make a small test edit, and select **Publish changes**. The first
   save creates `content/site-content.json` on `site-content`. The public site
   will then show the change on reload. The editor blocks stale drafts rather
   than overwriting another admin's newer work.

The private key may be entered with real line breaks or literal `\n` escapes.
Keep it only in Netlify environment variables, never in GitHub or the browser.
Without these settings, the site continues to show bundled copy and the
editor's Publish button stays disabled.

## Static photos

The site uses optimized files in `public/media/`. Netlify publishes them with
the site; no media API, storage credentials, or Wix image requests are needed.
Gallery thumbnails and the mobile hero have smaller dedicated files. The
source folders on Desktop are not modified by the import.

To reprocess local source folders on macOS:

```bash
node scripts/optimize-static-media.mjs /path/to/albums /path/to/assets
```

The script requires the built-in macOS `sips` command. It writes optimized
photos to `public/media/albums/<slug>/photos/`, thumbnails to `thumbs/`, a
cover from an album photo when one does not already exist, and site images to
`public/media/assets/`. Existing covers are preserved on reruns, including
the three original Wix covers recovered separately.
It also refreshes small thumbnails for every photo already in the retreat
gallery, including the 12 additional Wix photos recovered into `public/media/`.
When adding a new album, update `src/siteData.js` with its original photo count
and local paths, then rebuild and deploy. Its displayed title, date, and
description can then be edited in `/admin`. Remove any obsolete
files from `public/media/` when an album is retired; the importer does not
delete files automatically. Photos on a public site can be viewed and saved
by visitors.

After deploying this version, remove the unused `R2_*` variables from Netlify
and revoke the old R2 API token in Cloudflare. The bucket can then be deleted
by the account owner once no other project uses it.

## Current notes

- Only six photos are available for each of `First Trip`, `Pastor Vision Tour`,
  and `First Trip on Our Own`; their current Wix archives list 91, 108, and 98.
- `Second Mission Trip` has its original cover, but no recovered interior
  photos; the original archive lists 77 photos.
- All 18 public Retreats page photos are local. The page shows six in its
  collage and opens the complete set in a lightbox.
- Review the old Wix site later for missing photos and any other omitted content.
- The contact form is implemented and needs the production Resend and Turnstile environment values before launch.
- Copy editing is available in `/admin` after GitHub App setup; photo upload
  and new album creation remain a later phase.
