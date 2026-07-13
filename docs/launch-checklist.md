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

- Buy and configure the production domain, for example `tricord.cc`.
- In GoDaddy/cPanel hosting, point the domain to the hosting account and upload the built files to `public_html/`.
- Add the correct DNS records from the host dashboard.
- Build with `VITE_BASE_PATH=/` for the root domain.
- Upload the contents of `dist/`, not the project source, to GoDaddy `public_html/`.
- Confirm `https://tricord.cc/` loads the marketing homepage and `https://tricord.cc/app` opens the application sign-in flow.
- Confirm deep links under `/app` work after a hard refresh; the included static `404.html` fallback restores SPA routes for static hosts.
- After DNS is active, confirm HTTPS is enforced.

### Static Build And Upload

- Confirm `.env.local` contains the production Supabase URL and anon key.
- Run `VITE_BASE_PATH=/ npm run build`.
- Confirm `dist/index.html`, `dist/404.html`, and `dist/.htaccess` exist.
- Upload everything inside `dist/` to GoDaddy `public_html/`.
- Confirm the deployed page loads the latest build after a hard refresh.

### Supabase Auth

- Set the Site URL to `https://tricord.cc/app` so magic links return to the application.
- Add redirect URLs for:
  - `https://tricord.cc/app`
  - `https://tricord.cc/*`
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
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_URL=https://tricord.cc`
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
