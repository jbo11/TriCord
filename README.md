# TriCord

TriCord is a collaboration-first work hub organized around focused posts, Rooms, tasks, knowledge, files, and optional workforce tools. The root route is a conversion-focused marketing website, while the application runs under `/app`. The app is a single-page, app-like layout backed by Supabase Auth, Postgres, Realtime, and Row Level Security.

## Current Scope

- Supabase magic-link authentication.
- First-run hub creation.
- Owner/admin invite links for employees and guests.
- Room navigation.
- Post creation and active-feed ranking.
- Thread replies and decision marking.
- Task, knowledge, and admin shells connected to the production data model.
- Strict page layout where only the feed list and thread activity panel scroll.

AI is intentionally removed from this release. Placeholder planning remains in documentation only; no AI provider keys, agent tables, or active AI workflows are required for this build.

## Environment

Create `.env.local`:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
# Optional. Use / for the production root domain.
VITE_BASE_PATH=/
```

## Supabase

Apply the migrations in order:

```bash
supabase db push
```

Required migrations:

- `supabase/migrations/20260624153000_initial_tricord_schema.sql`
- `supabase/migrations/20260624200000_onboarding_policies.sql`
- `supabase/migrations/20260624203000_workspace_onboarding_rpc.sql`
- `supabase/migrations/20260624204500_reload_workspace_onboarding_rpc.sql`
- `supabase/migrations/20260624210000_workspace_invitations.sql`

## Member Sign-In

Members and guests do not create the company hub themselves.

1. Owner or admin opens `Admin`.
2. Enter the employee email and role.
3. Copy the generated invite link.
4. The invited user opens the link and signs in with the invited email.
5. After magic-link authentication, TriCord accepts the invite and adds the user to the hub.

If the invite opens while the browser is already signed in as another user, TriCord keeps the invite token and offers `Sign in with invited email`. Use that option, then request the magic link for the exact email that received the invite.

After an invite is accepted, Admins, Members, and Guests return through the normal TriCord sign-in screen. There are no separate role-specific login pages; access is loaded from their hub membership after authentication.

## Clean Start / Owner Bootstrap

If you deleted users to start fresh:

1. Sign out of TriCord if an old session is still open.
2. Sign in with the email that should become the first Owner.
3. When no memberships exist, TriCord shows `Create your Owner account`.
4. Create the first hub. The app creates the profile, hub, initial `General` room, and `owner` membership. The UI displays this role as `Owner`.
5. Open `Admin` and invite Admin, Member, or Guest accounts by email.

Invites cannot assign another Owner. Additional people join through Admin, Member, or Guest invite links.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the marketing homepage. Use `http://localhost:3000/app` for the TriCord application.

## Verify

```bash
npm test
npm run lint
npm run build
npm audit
```

## Launch

Before connecting a production domain or inviting external customers, complete the checklist in [`docs/launch-checklist.md`](docs/launch-checklist.md).

For GitHub Pages at `https://jbo11.github.io/TriCord/`, the included workflow builds with `VITE_BASE_PATH=/TriCord/` and deploys the `dist/` artifact automatically after pushes to `main`. Configure Supabase Auth Site URL and production redirects to `https://jbo11.github.io/TriCord/app` and `https://jbo11.github.io/TriCord/*` so magic links land in the application instead of the marketing homepage. For a future custom root-domain static host, set `VITE_BASE_PATH=/` before building and update the Supabase redirects to that domain.
