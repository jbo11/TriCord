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

- Buy and configure the production domain, for example `tricord.app`.
- If deploying on GitHub Pages with a custom domain, add the domain in GitHub Pages settings.
- Add the correct DNS records from the host dashboard.
- Set the GitHub repository variable `VITE_BASE_PATH=/` for a custom root domain.
- Keep `VITE_BASE_PATH=/TriCord/` only while serving from `https://jbo11.github.io/TriCord/`.
- After DNS is active, confirm HTTPS is enforced.

### GitHub Actions

- Add or confirm these repository secrets or variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_BASE_PATH`
- Confirm the Pages workflow completes after every push to `main`.
- Confirm the deployed page loads the latest commit after a hard refresh.

### Supabase Auth

- Set the Site URL to the production domain.
- Add redirect URLs for:
  - `https://tricord.app/*`
  - The current GitHub Pages URL while it remains active.
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
- Review Realtime settings for `posts`, `comments`, `tasks`, and workforce tables.

### Supabase Edge Functions

- Deploy `link-preview` before relying on rich URL cards in production.
- Add function secrets:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
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
