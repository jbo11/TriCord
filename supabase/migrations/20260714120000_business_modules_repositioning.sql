-- Product repositioning: optional Business Modules per Hub.
-- Existing Hubs keep the current workforce-related modules enabled so no active customer loses access.
-- New Hubs default to collaboration-first with Business Modules disabled until an Owner enables them.

alter table public.workspaces
  add column if not exists business_modules jsonb not null default '{"attendance_tracking": false, "employee_records": false, "payroll_preparation": false, "recruitment": false, "crm": false}'::jsonb,
  add column if not exists business_module_disclaimers jsonb not null default '{}'::jsonb;


-- Preserve current behavior for Hubs that existed before this release.
update public.workspaces
set business_modules = business_modules || '{"attendance_tracking": true, "employee_records": true, "payroll_preparation": true}'::jsonb
where business_module_disclaimers = '{}'::jsonb
  and business_modules @> '{"attendance_tracking": false, "employee_records": false, "payroll_preparation": false}'::jsonb;

update public.workspaces
set business_modules = jsonb_build_object(
  'attendance_tracking', coalesce((business_modules->>'attendance_tracking')::boolean, true),
  'employee_records', coalesce((business_modules->>'employee_records')::boolean, true),
  'payroll_preparation', coalesce((business_modules->>'payroll_preparation')::boolean, true),
  'recruitment', coalesce((business_modules->>'recruitment')::boolean, false),
  'crm', coalesce((business_modules->>'crm')::boolean, false)
)
where business_modules is null
   or not (business_modules ? 'attendance_tracking')
   or not (business_modules ? 'employee_records')
   or not (business_modules ? 'payroll_preparation')
   or not (business_modules ? 'recruitment')
   or not (business_modules ? 'crm');

comment on column public.workspaces.business_modules is 'Owner-controlled optional Business Module flags. Core collaboration features do not depend on these flags.';
comment on column public.workspaces.business_module_disclaimers is 'Accepted Business Module disclaimer versions keyed by module name.';
