# TriCord Launch Checklist

TriCord can be prepared for a public beta launch once the checklist below is complete. This checklist is intentionally practical: it separates code-level checks from external dashboard work that cannot be fully represented in the repository.

## Current Launch Status

- Codebase builds successfully with Vite.
- TypeScript checks pass with `npm run lint`.
- Permission matrix tests pass with `npm test`.
- Supabase migrations are applied to the linked project.
- Supabase schema lint reports no public schema errors.
- `npm audit` reports no known dependency vulnerabilities.
- `.env` files, build output, dependencies, and macOS metadata are ignored by Git.

## Required Before Public Domain Launch

### Domain And Hosting

- Connect this GitHub repository to Cloudflare Pages.
- Use `npm run build:cloudflare` as the Cloudflare Pages build command.
- Use `dist` as the Cloudflare Pages build output directory.
- Build with `VITE_BASE_PATH=/` for `https://tricord.pages.dev/` or any future root custom domain.
- Confirm `https://tricord.pages.dev/` loads the marketing homepage and `https://tricord.pages.dev/app` opens the application sign-in flow.
- Confirm deep links under `/app` work after a hard refresh; the included static `404.html` fallback restores SPA routes for static hosts.
- Confirm `https://jbo11.github.io/TriCord/` and `https://jbo11.github.io/TriCord/app` redirect to Cloudflare Pages.
- Confirm `https://tricordapp.netlify.app/` and `https://tricordapp.netlify.app/app` redirect to Cloudflare Pages.
- After any custom DNS is active, confirm HTTPS is enforced.

### Static Build And Deploy

- Confirm `.env.local` contains the production Supabase URL and publishable key.
- Run `npm run build:cloudflare`.
- Confirm `dist/index.html`, `dist/404.html`, and `dist/.htaccess` exist.
- Confirm `dist/_redirects` exists for Cloudflare Pages SPA routing.
- Confirm the Cloudflare Pages deployment loads the latest build after a hard refresh.
- Confirm GitHub Actions uses `npm run build:github-redirect` for the GitHub Pages redirect artifact.
- Confirm Netlify uses `npm run build:netlify-redirect` with `dist` as the publish directory for the Netlify redirect artifact.

### Supabase Auth

- Set the Site URL to `https://tricord.pages.dev/app` so magic links return to the application.
- Add redirect URLs for:
  - `https://tricord.pages.dev/app`
  - `https://tricord.pages.dev/*`
  - `https://jbo11.github.io/TriCord/*` during the redirect transition.
  - `https://tricordapp.netlify.app/*` during the redirect transition.
  - Local development URLs such as `http://localhost:3000/*`.
- Configure production SMTP so magic links come from a branded email sender.
- Check magic-link expiry and rate limits.
- Disable any unused auth providers.

### Supabase Database And Storage

- Confirm all migrations show as applied with `supabase migration list --linked`.
- Confirm daily backups are enabled for the production database plan.
- Confirm storage buckets exist and match the app:
  - `workspace-files`
  - `employee-documents`
  - `avatars`
- Confirm storage upload limits match the SaaS plan rules before accepting broad customer usage.
- Confirm direct Supabase uploads are capped at 20 MB.
- Confirm files larger than 20 MB fail with guidance to share a Google Drive, Dropbox, OneDrive, or other cloud-storage link.
- Review Realtime settings for `posts`, `comments`, `tasks`, and workforce tables.

### Supabase Edge Functions

- Deploy `link-preview` before relying on rich URL cards in production.
- Deploy Stripe billing functions before enabling paid upgrades:
  - `create-checkout-session`
  - `create-billing-portal-session`
  - `stripe-webhook`
- Add shared function secrets:
  - `SUPABASE_URL`
  - `EDGE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_URL=https://tricord.pages.dev`
  - `APP_ORIGIN=https://tricord.pages.dev`
- Add Stripe function secrets:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PLUS_MONTHLY_PRICE_ID`
  - `STRIPE_PLUS_YEARLY_PRICE_ID`
  - `STRIPE_PRO_MONTHLY_PRICE_ID`
  - `STRIPE_PRO_YEARLY_PRICE_ID`
- Configure the Stripe webhook endpoint to call the deployed `stripe-webhook` function for checkout and subscription events.
- Confirm link previews reject private network URLs and require an authenticated user.

### Privacy, Legal, And Business Operations

- Publish Terms of Service and Privacy Policy pages before collecting public customer data.
- Decide whether HR, payroll, and timekeeping are beta features or production-supported features.
- Add a clear data retention and deletion process.
- Add a support contact email.
- Add an incident response process for leaked credentials or customer data.

### Monitoring And Support

- Add frontend error monitoring before public launch, such as Sentry.
- Add product analytics only after privacy policy coverage is ready.
- Add uptime monitoring for the production domain.
- Add a private admin/support process for user-reported issues.

## Recommended Manual Smoke Test

Run this after every production deploy:

1. Sign in as Owner.
2. Create a Hub.
3. Create Rooms, posts, replies, tasks, and a knowledge article.
4. Invite an Admin, Member, and Guest.
5. Confirm Admin only sees delegated Admin features.
6. Confirm Member cannot see Admin-only controls.
7. Confirm Guest only sees invited Rooms.
8. Send messages from two different accounts and confirm realtime updates.
9. Upload an attachment and confirm it appears only to permitted users.
10. Change a user role and confirm the UI updates after refresh.
11. Use Timekeeping as an Admin or Member.
12. Confirm Owner-only payroll and private profile fields are not visible to unauthorized roles.

## Go/No-Go Rule

TriCord is ready for a public beta when the automated checks pass and the manual smoke test succeeds for Owner, Admin, Member, and Guest accounts on the production domain.

Do not market HR/payroll as fully compliant production software until payroll rules, tax handling, audit exports, employee document retention, and legal review are complete for the launch country.
