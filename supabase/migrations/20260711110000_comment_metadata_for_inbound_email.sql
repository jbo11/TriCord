-- Store metadata for system-created comments such as appended inbound emails.

alter table public.comments
add column if not exists metadata jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
