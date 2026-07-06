-- The business audit trigger records the table and row that changed.
-- Older projects created audit_logs before those target columns existed.

alter table public.audit_logs
  add column if not exists target_table text,
  add column if not exists target_id uuid;

create index if not exists audit_logs_target_idx
  on public.audit_logs (workspace_id, target_table, target_id, created_at desc);

notify pgrst, 'reload schema';
