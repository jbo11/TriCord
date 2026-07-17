alter table public.employee_profiles
  add column if not exists exemption_status text;

update public.employee_profiles
set exemption_status = 'non_exempt'
where exemption_status is null;

alter table public.employee_profiles
  alter column exemption_status set default 'non_exempt';

alter table public.employee_profiles
  alter column exemption_status set not null;

do $$
begin
  alter table public.employee_profiles
    add constraint employee_profiles_exemption_status_check
    check (exemption_status in ('exempt', 'non_exempt'));
exception
  when duplicate_object then null;
end $$;

comment on column public.employee_profiles.exemption_status is
  'Customer-maintained recordkeeping classification for exempt or non-exempt employees. TriCord does not determine legal classification.';
