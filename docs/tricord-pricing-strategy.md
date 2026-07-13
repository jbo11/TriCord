# TriCord Pricing Strategy

Last reviewed: July 7, 2026

## Recommendation

Launch TriCord with three customer-facing plans: Free, Plus, and Pro. Keep Enterprise out of the initial public launch so pricing, billing, product limits, support, and onboarding stay simple.

Price each Hub independently and bill only active Owners, Admins, and Members. Guests are free within each plan's guest allowance. A person may join multiple Hubs, and each Hub controls its own subscription.

| Plan | Monthly billing | Annual billing | Best for |
| --- | ---: | ---: | --- |
| Free | $0 | $0 | Individuals, founders, and very small teams evaluating TriCord |
| Plus | $9 per active user/month | $7 per active user/month, billed annually ($84/user/year) | Small teams that need complete collaboration, tasks, knowledge, basic HR, payroll drafts, and team timekeeping |
| Pro | $18 per active user/month | $15 per active user/month, billed annually ($180/user/year) | Growing businesses that need advanced operations, payroll controls, reporting, audit history, automation, and security |

Annual pricing saves roughly 17-22%. Keep an active-user billing model: a paid seat is billable only when that person takes an action during the billing window. Do not charge a user merely for belonging to a Hub.

Enterprise can be introduced later after the core billing system, entitlements, support process, and security posture are mature.

## Complete Plan Matrix

| Capability | Free | Plus | Pro |
| --- | --- | --- | --- |
| Owned Hubs per account | 1 | 5 | Unlimited |
| Joined Hubs | Unlimited | Unlimited | Unlimited |
| Paid Owners/Admins/Members per Hub | 10 | 100 | Unlimited, fair use |
| Guests per Hub | 5 | 50 | Unlimited, fair use |
| Rooms per Hub | 10 | Unlimited | Unlimited |
| Message history | 90 days searchable | Unlimited | Unlimited plus custom retention presets |
| Hub storage | 1 GB | 100 GB | 1 TB |
| Maximum direct upload | 20 MB | 20 MB | 20 MB |
| Active Feed and discussions | Included | Included | Included |
| Thread replies and attachments | Included | Included | Included |
| Link previews | Included | Included | Included |
| Tasks: board, list, calendar | Included | Included | Included |
| Task assignment and archive | Included | Included | Included |
| Knowledge base | Included | Included | Included |
| Timekeeping | Personal/basic clock in/out | Full team controls | Advanced policies, location, device, and audit controls |
| HR profile records | Basic profile records | Full HR records and approvals | Advanced HR workflows and document controls |
| Leave requests | Basic request flow | Approval workflow | Advanced approval rules and reports |
| Payroll | Preview and manual draft | Payroll runs and standard rules | Advanced rules, approvals, exports, and country packs |
| Payroll custom fields | 3 fields | 25 fields | Unlimited, fair use |
| Payment method tracking | Basic | Included | Included |
| Reports | Basic dashboard | Standard reports and exports | Custom reports, scheduled delivery, and advanced analytics |
| Integrations | 3 | 25 | Unlimited plus API and webhooks |
| Automations | 100 actions/month | 5,000 actions/month | 25,000 actions/month |
| Larger file sharing | Share cloud-storage links manually | Share cloud-storage links manually | Share cloud-storage links manually |
| Roles | Owner, Admin, Member, Guest | Same plus granular guest permissions | Custom roles and permission templates |
| Admin permissions | Basic | Role permission controls | Advanced granular permissions |
| Audit history | 7 days | 90 days | 1 year |
| Authentication | Email magic links | Email magic links plus session controls | Session policies and admin-managed access |
| Security controls | Encryption, basic sessions, RLS-backed access | Data export and improved session controls | IP controls, advanced audit, legal export roadmap |
| Data export | Manual/basic | Standard export | Advanced exports |
| Custom domain | Not included | Not included | 1 custom domain per Hub |
| Branding | Basic Hub color | Custom Hub color and logo | Advanced branding controls |
| Support | Help center and community/email | Priority email, 1-business-day target | Priority support, 4-business-hour target |
| Onboarding | Self-serve | Self-serve plus setup guide | Assisted onboarding option |
| Billing | Hub-level self-serve | Hub-level self-serve | Hub-level self-serve plus invoices |

## Recommended Feature Positioning

| Plan | Positioning | What must feel valuable | What should encourage upgrade |
| --- | --- | --- | --- |
| Free | Real product, not a demo | A small team can use posts, Rooms, tasks, knowledge, and basic timekeeping | 90-day history, 1 GB storage, 10 paid members, 10 Rooms |
| Plus | Complete small-team operating system | Removes most collaboration limits and unlocks usable team operations | Payroll depth, custom reports, automation volume, audit history |
| Pro | Serious business operations | Payroll, HR, reporting, audit, permissions, security, and automation become stronger | Larger scale, stronger controls, custom retention, support expectations |

## Billing Rules

1. A subscription belongs to a Hub, not to a global user account.
2. Membership and role remain scoped to a Hub. One email can be an Owner in one Hub and a Guest or Member elsewhere.
3. Owners, Admins, and Members consume paid seats on paid plans; Guests do not, subject to plan limits.
4. A paid seat should be counted as active when the user performs a meaningful action during the billing period.
5. Seats added mid-cycle are prorated. Inactive seats receive a credit at renewal.
6. Downgrades preserve data during a 30-day grace period, then make over-limit content read-only rather than deleting it.
7. Plan enforcement must occur in database/API authorization and storage policies, not only by hiding frontend controls.

## Upgrade Logic

- Free must be useful enough to establish a team's working history. The 90-day history, storage, member, and Room limits create natural upgrade moments without disabling core work.
- Plus should feel complete for most small teams. It removes history and Room limits and unlocks the full workforce suite.
- Pro should monetize operational complexity: advanced payroll, audit, permissions, automation, custom reporting, retention, and larger storage.
- AI is out of scope for this release. Keep placeholders only and add AI usage packs later after entitlement enforcement is mature.
- Storage should use explicit limits rather than an early-stage "unlimited" promise. Sell extra storage in 100 GB or 1 TB increments depending on plan.
- A Free account may own one Hub but can join unlimited Hubs. Creating a second owned Hub prompts the user to upgrade that new Hub or transfer ownership.

## Competitive Benchmark

| Product | Current reference point | Lesson for TriCord |
| --- | --- | --- |
| Slack | Free has 90-day history; Pro and Business+ monetize history, admin, and compliance controls | TriCord can match familiar history limits while differentiating through tasks, knowledge, HR, and payroll |
| ClickUp | Free is generous; paid plans monetize dashboards, automation, permissions, and advanced work management | TriCord's closest value anchor because it combines work management with collaboration |
| Notion | Paid plans monetize collaboration, file uploads, history, permissions, and workspace controls | Knowledge-base buyers accept higher pricing for history, permissions, and file capacity |
| Microsoft Teams | Business plans bundle meetings, storage, identity, and Microsoft apps | TriCord should not compete on commodity storage alone; its unified operations workflow is the differentiator |
| Discord | Free and paid tiers are user-centric, with attachment and server boosts as upgrade triggers | Use Discord as a usability and attachment benchmark, not as the primary B2B pricing anchor |

## Source Notes

- Slack pricing and feature comparison: https://slack.com/pricing
- Slack Business+: https://slack.com/pricing/businessplus
- ClickUp pricing FAQ: https://clickup.com/faqs
- ClickUp workspace billing model: https://help.clickup.com/hc/en-us/articles/10129535087383-Intro-to-pricing
- Notion pricing: https://www.notion.com/pricing
- Microsoft Teams business plans: https://www.microsoft.com/microsoft-teams/compare-microsoft-teams-options
- Discord attachment limits: https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ

## Before Taking Payments

- Replace the current legacy plan enum with a subscription/entitlement model that supports Free, Plus, and Pro.
- Add subscriptions, billing customers, seat usage, storage usage, invoices, and webhook event tables.
- Store explicit entitlement limits per Hub so paid plan behavior is enforced consistently.
- Keep provider identifiers and webhook secrets server-side.
- Add Stripe or another billing provider only after entitlement checks and downgrade behavior have automated tests.
- Publish Terms of Service, Privacy Policy, acceptable-use rules, refund policy, and data retention behavior before launch.
