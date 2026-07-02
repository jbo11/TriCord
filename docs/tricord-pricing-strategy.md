# TriCord Pricing Strategy

Last reviewed: July 2, 2026

## Recommendation

Price each Hub independently and bill only active Members, Admins, and Owners. Guests are free within each plan's guest allowance. A person may join multiple Hubs, and each Hub controls its own subscription.

| Plan | Monthly billing | Annual billing | Best for |
| --- | ---: | ---: | --- |
| Free | $0 | $0 | Individuals and small teams evaluating TriCord |
| Plus | $9 per active user/month | $7 per active user/month ($84/year) | Small teams that need complete collaboration and workforce tools |
| Pro | $15 per active user/month | $12 per active user/month ($144/year) | Growing teams that need automation, payroll controls, security, and reporting |

Annual pricing saves about 20-22%. Keep an active-user billing model: a paid seat is billable only when that person takes an action during the billing window. Do not charge a user merely for belonging to a Hub.

## Plan Matrix

| Capability | Free | Plus | Pro |
| --- | --- | --- | --- |
| Owned Hubs per account | 1 | 5 | Unlimited |
| Joined Hubs | Unlimited | Unlimited | Unlimited |
| Paid members per Hub | 10 | 100 | Unlimited, fair use |
| Guests per Hub | 5 | 50 | Unlimited, fair use |
| Rooms | 10 | Unlimited | Unlimited |
| Message history | 90 days searchable | Unlimited | Unlimited plus custom retention |
| Hub storage | 1 GB | 100 GB | 1 TB |
| Maximum file upload | 25 MB | 250 MB | 2 GB |
| Active Feed and discussions | Included | Included | Included |
| Tasks: board, list, calendar | Included | Included | Included |
| Knowledge base | Included | Included | Included |
| Timekeeping | Personal/basic | Full team controls | Advanced policies, location and audit controls |
| HR | Employee profiles and leave requests | Full HR records and approvals | Advanced workflows and document controls |
| Payroll | Preview and manual draft | Payroll runs and standard rules | Advanced rules, approvals, exports, and country packs |
| Reports | Basic dashboard | Standard reports and exports | Custom reports, scheduled delivery, and advanced analytics |
| Integrations | 3 | 25 | Unlimited plus API and webhooks |
| Automations | 100 actions/month | 5,000 actions/month | 25,000 actions/month |
| AI allowance | 50 actions/Hub/month | 1,000 actions/Hub/month | 5,000 actions/Hub/month |
| Roles | Owner, Admin, Member, Guest | Same plus granular guest permissions | Custom roles and permission templates |
| Audit history | 7 days | 90 days | 1 year |
| Authentication and security | Encryption, 2FA, basic sessions | Session policies and data export | SAML SSO, SCIM, IP controls, legal export |
| Support | Help center and community/email | Priority email, 1-business-day target | Priority support, 4-hour business-hours target |

## Upgrade Logic

- Free must be useful enough to establish a team's working history. The 90-day history, storage, and member limits create natural upgrade moments without disabling core work.
- Plus should feel complete for most small teams. It removes history and Room limits and unlocks the full workforce suite.
- Pro should monetize operational complexity: advanced payroll, audit, SSO/SCIM, automation, custom reporting, retention, and larger storage.
- AI should be pooled per Hub and metered by completed action. Offer additional AI packs instead of silently throttling paid teams.
- Storage should use explicit limits rather than an early-stage "unlimited" promise. Sell extra storage in 100 GB increments.
- A Free account may own one Hub but can join unlimited Hubs. Creating a second owned Hub prompts the user to upgrade that new Hub or transfer ownership.

## Billing Rules

1. A subscription belongs to a Hub, not to a global user account.
2. Membership and role remain scoped to a Hub. One email can be an Owner in one Hub and a Guest or Member elsewhere.
3. Owners, Admins, and Members consume paid seats on paid plans; Guests do not, subject to plan limits.
4. Seats added mid-cycle are prorated. Inactive seats receive a credit at renewal.
5. Downgrades preserve data during a 30-day grace period, then make over-limit content read-only rather than deleting it.
6. Plan enforcement must occur in database/API authorization and storage policies, not only by hiding frontend controls.

## Competitive Benchmark

| Product | Current reference point | Lesson for TriCord |
| --- | --- | --- |
| Slack | Free has 90-day history; Pro is $7.25 annual or $8.75 monthly; Business+ is $15 annual or $18 monthly | TriCord can match familiar history limits and undercut advanced collaboration |
| ClickUp | Free is generous; Unlimited is $7 annual and Business is $12 annual | Strongest direct price anchor because TriCord also combines tasks, docs, chat, and operations |
| Notion | Free is $0, Plus $10, Business $20; Free uploads are 5 MB and paid uploads reach 5 GB | Knowledge and documentation buyers accept higher pricing for history, permissions, and file capacity |
| Microsoft Teams | Essentials is $4 annual with 10 GB per user; Business Basic is $6 annual with 1 TB and Microsoft apps | TriCord should not compete on commodity storage alone; its workforce workflow is the differentiator |
| Discord | Free uploads are 10 MB; Nitro is a consumer per-person upgrade rather than a team workspace plan | Use Discord as a usability and attachment benchmark, not as the primary B2B pricing anchor |

## Source Notes

- Slack pricing and feature comparison: https://slack.com/pricing
- Slack Business+: https://slack.com/pricing/businessplus
- ClickUp pricing FAQ: https://clickup.com/faqs
- ClickUp workspace billing model: https://help.clickup.com/hc/en-us/articles/10129535087383-Intro-to-pricing
- Notion pricing: https://www.notion.com/pricing
- Microsoft Teams business plans: https://www.microsoft.com/microsoft-teams/compare-microsoft-teams-options
- Discord attachment limits: https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ

## Before Taking Payments

- Replace the current legacy plan enum (free, pro, business, enterprise) with a subscription/entitlement model that supports Free, Plus, and Pro.
- Add subscriptions, billing customers, seat usage, metered AI usage, storage usage, invoices, and webhook event tables.
- Keep provider identifiers and webhook secrets server-side.
- Add Stripe or another billing provider only after entitlement checks and downgrade behavior have automated tests.
- Publish Terms of Service, Privacy Policy, acceptable-use rules, refund policy, and data retention behavior before launch.
