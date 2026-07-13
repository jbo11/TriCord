# TriCord Production Readiness Review

Date: July 6, 2026

## Executive verdict

TriCord has a credible product core and is useful as a private beta. The combination of contextual discussions, tasks, knowledge, and employee operations can provide real value to small distributed teams. It is not yet ready to be marketed as a production HR or payroll system, accept subscription payments, or hold unrestricted customer data.

Recommended positioning for the next release:

- Production candidate: Active Feed, Rooms, discussions, Tasks, Knowledge, profiles, Hub switching.
- Controlled beta: Timekeeping and HR self-service.
- Preview only: Payroll and workforce reporting until calculations, approvals, auditability, exports, and jurisdictional validation are complete.
- Not implemented: enforceable Free/Plus/Pro subscription entitlements.

Buying the domain is low risk, but public onboarding and paid acquisition should wait until the launch gates in this review are complete.

## What is already strong

- Clear Hub and Room mental model.
- Discussions remain attached to a post instead of becoming an unstructured chat stream.
- Tasks support Board, List, and Calendar views.
- Knowledge is separated from archived conversations and functions as a reusable repository.
- One identity can participate in multiple Hubs with a different role in each Hub.
- Supabase RLS is enabled throughout the main schema.
- Workforce monetary values are encrypted before storage in the sensitive payroll table.
- Light/dark themes, accent personalization, responsive navigation, and a collapsible discussion panel are present.
- Local and remote migration histories are synchronized as of this review.

## Launch-blocking findings

### P0: Profile privacy is too broad

The `users` table contains public identity fields and private fields such as phone, address, and bio. The workspace-peer policy allows every person sharing any Hub to select the same complete row. PostgreSQL RLS filters rows, not individual columns, so a Member or Guest can potentially retrieve fields that the interface does not show.

Required correction:

- Split public profile fields from private contact/profile details, or expose a restricted public-profile view.
- Define exactly which roles can access phone, address, emergency contacts, compensation, and employment documents.
- Add automated RLS tests for Owner, Admin, Member, Guest, unrelated authenticated user, and anonymous user.

### P0: Admin is an overpowered business role

Current HR and payroll policies treat every Admin as a workforce administrator. Every Admin can manage employee profiles, documents, performance, leave, payroll periods, and payroll items. The interface also exposes HR and Payroll to all Admins. The two existing delegated permissions only cover timekeeping settings and attendance corrections.

Required correction:

- Keep `Admin` as a Hub administration role, not an automatic HR/payroll role.
- Introduce Owner-controlled capabilities such as `manage_members`, `manage_hr`, `approve_leave`, `manage_payroll`, `approve_payroll`, `view_reports`, `manage_knowledge`, `manage_timekeeping`, and `correct_attendance`.
- Enforce every capability in both RLS/RPC logic and interface visibility.
- Separate payroll preparation, approval, and payment permissions to support separation of duties.

### P0: Payroll is not compliance-grade

The calculation currently uses daily eight-hour overtime, a fixed 1.5 multiplier, and user-entered fixed/percentage rules. It does not implement jurisdiction-specific withholding tables, wage bases, tax deposits, employer taxes, garnishment priority, benefits, retroactive adjustments, corrected returns, or country-specific remittance files.

Required correction:

- Rename the module `Payroll Preview` while it remains an estimator, or hide it in public production.
- Choose the first supported country and payroll scope rather than claiming global payroll.
- Have a licensed payroll/accounting professional validate formulas and outputs.
- Add immutable pay-run snapshots, correction/reversal workflows, approval history, payslips, exports, and reconciliation totals.
- Never silently recompute an approved or paid period.

The IRS publishes current employer withholding and reporting requirements in Publication 15 and Publication 15-T. The U.S. Department of Labor also requires covered employers to retain specific wage and hours records. Equivalent requirements must be evaluated for every supported jurisdiction.

### P0: Audit tables do not create an audit trail

`activity_logs` and `audit_logs` exist, but no application or database code writes business events to them. Attendance edits, role changes, payroll approval, document access, compensation changes, and destructive actions therefore lack a reliable history.

Required correction:

- Add append-only audit events from database functions/triggers for privileged actions.
- Record actor, tenant, target, before/after values where appropriate, reason, timestamp, and request metadata.
- Prevent ordinary application roles from updating or deleting audit events.
- Define retention by plan and applicable law.

### P0: There is no automated product or permission test suite

The repository currently runs TypeScript checking and a production build only. There are no unit, integration, database policy, browser, accessibility, or multi-user realtime tests.

Required correction:

- Add Vitest/React Testing Library for business and component behavior.
- Add Supabase database tests for every RLS policy and privileged RPC.
- Add Playwright journeys for onboarding, invitations, Hub switching, collaboration, role visibility, timekeeping, HR, and payroll preview.
- Test two simultaneous accounts for realtime updates.
- Add automated accessibility checks and manual keyboard/screen-reader verification.

### P0: Subscription entitlements are not enforced

The pricing matrix is a strategy document. Hub limits, member limits, Room limits, storage quotas, message retention, integrations, automations, and security features are not fully enforced server-side. Direct uploads are capped at 20 MB in this release. Billing checkout, webhook verification, subscription lifecycle handling, invoices, grace periods, and downgrade behavior are also absent.

Required correction:

- Finalize `free`, `plus`, and `pro` as the canonical plan enum.
- Create one server-side entitlement service used by database functions and application UI.
- Process billing webhooks through a trusted server/Edge Function and make them idempotent.
- Define what happens when a customer exceeds limits or downgrades.
- Do not advertise unavailable plan features.

## Role and navigation redesign

Visibility must follow effective capabilities, not only the four broad membership roles.

| Surface | Owner | Delegated Admin | Member | Guest |
| --- | --- | --- | --- | --- |
| Active Feed | Full | Full | Full | Invited Rooms only |
| Tasks | Full | Full | Create/assigned/team as configured | Assigned/shared only |
| Knowledge | Manage | Manage if granted | Read/create as configured | Shared articles only |
| Timekeeping | Team administration; no personal clock by default | Settings/corrections only if granted | Own clock and history | Hidden |
| HR People | Full | Only if `manage_hr` | Own profile | Hidden |
| Leave | Approvals and policy | Approvals only if granted | Own requests/balance | Hidden |
| Payroll | Configure/prepare/approve according to capability | Only explicitly granted step | Own finalized payslips | Hidden |
| Reports | Full | Only explicitly granted reports | Personal reports only if useful | Hidden |
| Hub Admin | Full | Member/Room functions explicitly granted | Hidden | Hidden |

Owner-specific correction:

- Hide `Request leave` by default for Owners.
- If an Owner is also an employee, provide an explicit `Owner is included in workforce` setting that enables employee self-service separately from Owner administration.

Guest-specific correction:

- Guests should not inherit Hub-wide Tasks, Knowledge, people lists, or public Room data merely because they have a membership.
- Access should be based on explicit Room/resource sharing and tested at the database layer.

## Professional reviews

### Senior HR Director

Useful today:

- Employee profiles, leave requests, documents, performance notes, and timekeeping provide a good operational foundation.

Missing or unclear:

- Employee lifecycle states with effective dates and offboarding.
- Manager approval chains and delegation during absence.
- Leave accrual rules, carryover, blackout dates, half-days, cancellation, attachments, and region-specific holidays.
- Required-document tracking, expiry reminders, acknowledgements, and document version history.
- Confidential-note visibility and stronger separation between public profile, HR file, and payroll data.
- Employee consent and retention policies for GPS, IP, device, selfie, and identity documents.
- Correction reasons and employee acknowledgement for edited attendance.

### Senior Accountant

Useful today:

- Pay periods, encrypted compensation, earnings/deduction rules, and gross/net summaries establish the shape of a payroll workflow.

Missing or unsafe:

- Country/state tax engines and effective-dated rates.
- Employer liabilities and payroll tax deposit schedules.
- Approval separation, period close, reversal, adjustment, and off-cycle payroll.
- General-ledger mapping, journal exports, liability reconciliation, and bank/payment exports.
- Payslip generation and year-to-date balances.
- Rounding policy, multi-currency policy, retroactive changes, taxable benefit treatment, and statutory reports.

### Senior Bookkeeper

TriCord does not currently replace bookkeeping software. It lacks a chart of accounts, bank reconciliation, vendors, bills, customer invoices, expenses, receipts, journal entries, and financial statements.

Recommendation:

- Integrate with accounting platforms instead of building a general ledger during the first launch phase.
- Export approved payroll journals with stable account mappings and traceable totals.
- Add CSV/PDF exports and reconciliation reports before asking bookkeepers to rely on the module.

### Senior Web Application Developer

Strengths:

- Modern React/Vite foundation, Supabase Auth/Postgres/RLS, typed domain models, and migration-based schema management.

Risks:

- `App.tsx` and `WorkforceModules.tsx` are large, tightly coupled modules that will become difficult to test and change safely.
- Most data access is called directly from UI components; privileged business workflows should use domain services and transactional database functions.
- Native browser prompts are used for material HR/payroll actions and do not provide validation, review, or recoverability.
- Realtime has a three-second reconciliation poll in addition to subscriptions, which increases database load as usage grows.
- Supabase TypeScript types are handwritten rather than generated from the schema.
- The primary JavaScript bundle exceeds the current 500 kB warning threshold.
- There is no error monitoring, product analytics, performance monitoring, feature flagging, or staged rollout mechanism.
- Development and production need separate Supabase projects, environment controls, and deployment approvals.

### Entrepreneur and Business Owner

The strongest customer promise is: `one place where a small team discusses work, turns it into tasks, documents how work is done, and manages basic employee operations.`

The current scope risks weakening that promise by trying to become Slack, project management, HRIS, payroll, and accounting at once. Payroll is especially expensive to support and creates material liability.

Recommended launch scope:

1. Collaboration, Tasks, Knowledge, and multi-Hub administration.
2. Timekeeping and HR self-service as an optional workforce add-on.
3. Payroll Preview with explicit disclaimers, or postpone payroll until one country is fully supported.
4. Integrate with established payroll/accounting providers before attempting broad global payroll.

## Workflow and UX findings

- Replace every `window.prompt` HR/payroll workflow with a validated form or drawer.
- Add clear success/error toasts that remain associated with the action performed.
- Add unsaved-change protection for long forms and article editing.
- Add notification center behavior; the schema has notifications but the product lacks a complete workflow.
- Add searchable command/navigation behavior as modules increase.
- Add empty-state guidance that describes the next business action, not the product itself.
- Make destructive actions explain impact and, where possible, use archive/restore before permanent deletion.
- Add exports to Tasks, HR, Timekeeping, Payroll Preview, and Reports.
- Test every screen at mobile, tablet, standard desktop, wide desktop, keyboard-only, and 200% zoom.
- Use WCAG 2.2 AA as the accessibility release target.

## Security and operations gates

- Complete an OWASP ASVS-based security review focused on authentication, tenant isolation, access control, uploads, SSRF/link previews, error handling, and audit logging.
- Verify Supabase production checklist items: RLS, SSL enforcement, rate limits, backups/PITR, email delivery, custom SMTP, and spend controls.
- Add malware scanning for business documents and keep the 20 MB file limit enforced at both app and storage layers.
- Define incident response, backup restore testing, data export, account deletion, privacy requests, and breach notification procedures.
- Publish Terms of Service, Privacy Policy, subprocessors, retention policy, and acceptable-use rules before public onboarding.
- Add staging and production environments with separate keys and data.
- Remove all production changes performed manually in the SQL editor; migrations must remain the source of truth.

## Recommended implementation order

### Phase 1: Safety and role correctness

- Split public/private profiles.
- Implement capability-based permissions and guest resource isolation.
- Correct Owner/Leave behavior.
- Build append-only audit logging.
- Add RLS and end-to-end role tests.

### Phase 2: Product quality

- Replace prompts with proper workflows.
- Add notifications, exports, validation, accessibility, responsive QA, and observability.
- Break large components into domain modules and generate Supabase types.

### Phase 3: Workforce reliability

- Finish HR lifecycle, leave rules, attendance correction history, privacy/consent, and manager approvals.
- Restrict Payroll to Preview until validated.

### Phase 4: Commercial launch

- Build billing and server-side entitlements.
- Establish staging/production release controls, support operations, legal documents, and a tested rollback plan.
- Run a closed pilot with several businesses before public paid launch.

## Release decision

Current designation: **Private beta**.

Acceptable now:

- Continue testing with known users and non-critical data.
- Purchase the domain and prepare branding.
- Pilot collaboration, tasks, knowledge, and basic workforce flows with explicit beta expectations.

Not acceptable yet:

- Advertise compliant payroll.
- Process real payroll without independent professional verification and a controlled parallel run.
- Promise subscription limits or security features that are not enforced.
- Treat the system as the sole authoritative repository for legally required HR/payroll records.

## Reference standards

- OWASP Application Security Verification Standard: https://owasp.org/www-project-application-security-verification-standard/
- Supabase production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- U.S. Department of Labor recordkeeping: https://www.dol.gov/general/topic/wages/wagesrecordkeeping
- IRS Publication 15: https://www.irs.gov/publications/p15
- IRS Publication 15-T: https://www.irs.gov/publications/p15t

