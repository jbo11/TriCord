do $$
begin
  if to_regclass('public.memberships') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'memberships' and column_name = 'invited_by'
  ) then
    alter table public.memberships
      drop constraint if exists memberships_invited_by_fkey,
      add constraint memberships_invited_by_fkey
        foreign key (invited_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.workspace_invitations') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'workspace_invitations' and column_name = 'invited_by'
    ) then
      alter table public.workspace_invitations
        alter column invited_by drop not null,
        drop constraint if exists workspace_invitations_invited_by_fkey,
        add constraint workspace_invitations_invited_by_fkey
          foreign key (invited_by) references public.users(id) on delete set null;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'workspace_invitations' and column_name = 'accepted_by'
    ) then
      alter table public.workspace_invitations
        drop constraint if exists workspace_invitations_accepted_by_fkey,
        add constraint workspace_invitations_accepted_by_fkey
          foreign key (accepted_by) references public.users(id) on delete set null;
    end if;
  end if;

  if to_regclass('public.spaces') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'spaces' and column_name = 'created_by'
  ) then
    alter table public.spaces
      alter column created_by drop not null,
      drop constraint if exists spaces_created_by_fkey,
      add constraint spaces_created_by_fkey
        foreign key (created_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.posts') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'author_id'
  ) then
    alter table public.posts
      alter column author_id drop not null,
      drop constraint if exists posts_author_id_fkey,
      add constraint posts_author_id_fkey
        foreign key (author_id) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.comments') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'author_id'
  ) then
    alter table public.comments
      alter column author_id drop not null,
      drop constraint if exists comments_author_id_fkey,
      add constraint comments_author_id_fkey
        foreign key (author_id) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.attachments') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attachments' and column_name = 'uploaded_by'
  ) then
    alter table public.attachments
      alter column uploaded_by drop not null,
      drop constraint if exists attachments_uploaded_by_fkey,
      add constraint attachments_uploaded_by_fkey
        foreign key (uploaded_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.ai_agents') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_agents' and column_name = 'created_by'
  ) then
    alter table public.ai_agents
      alter column created_by drop not null,
      drop constraint if exists ai_agents_created_by_fkey,
      add constraint ai_agents_created_by_fkey
        foreign key (created_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.ai_messages') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_messages' and column_name = 'created_by'
  ) then
    alter table public.ai_messages
      drop constraint if exists ai_messages_created_by_fkey,
      add constraint ai_messages_created_by_fkey
        foreign key (created_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.tasks') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'assignee_id'
    ) then
      alter table public.tasks
        drop constraint if exists tasks_assignee_id_fkey,
        add constraint tasks_assignee_id_fkey
          foreign key (assignee_id) references public.users(id) on delete set null;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'created_by'
    ) then
      alter table public.tasks
        alter column created_by drop not null,
        drop constraint if exists tasks_created_by_fkey,
        add constraint tasks_created_by_fkey
          foreign key (created_by) references public.users(id) on delete set null;
    end if;
  end if;

  if to_regclass('public.knowledge_articles') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_articles' and column_name = 'created_by'
  ) then
    alter table public.knowledge_articles
      alter column created_by drop not null,
      drop constraint if exists knowledge_articles_created_by_fkey,
      add constraint knowledge_articles_created_by_fkey
        foreign key (created_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.employee_sensitive_payroll') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_sensitive_payroll' and column_name = 'updated_by'
  ) then
    alter table public.employee_sensitive_payroll
      drop constraint if exists employee_sensitive_payroll_updated_by_fkey,
      add constraint employee_sensitive_payroll_updated_by_fkey
        foreign key (updated_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.employee_documents') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_documents' and column_name = 'uploaded_by'
  ) then
    alter table public.employee_documents
      alter column uploaded_by drop not null,
      drop constraint if exists employee_documents_uploaded_by_fkey,
      add constraint employee_documents_uploaded_by_fkey
        foreign key (uploaded_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.performance_records') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'performance_records' and column_name = 'created_by'
  ) then
    alter table public.performance_records
      alter column created_by drop not null,
      drop constraint if exists performance_records_created_by_fkey,
      add constraint performance_records_created_by_fkey
        foreign key (created_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.leave_requests') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leave_requests' and column_name = 'reviewed_by'
  ) then
    alter table public.leave_requests
      drop constraint if exists leave_requests_reviewed_by_fkey,
      add constraint leave_requests_reviewed_by_fkey
        foreign key (reviewed_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.payroll_periods') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'payroll_periods' and column_name = 'created_by'
    ) then
      alter table public.payroll_periods
        alter column created_by drop not null,
        drop constraint if exists payroll_periods_created_by_fkey,
        add constraint payroll_periods_created_by_fkey
          foreign key (created_by) references public.users(id) on delete set null;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'payroll_periods' and column_name = 'approved_by'
    ) then
      alter table public.payroll_periods
        drop constraint if exists payroll_periods_approved_by_fkey,
        add constraint payroll_periods_approved_by_fkey
          foreign key (approved_by) references public.users(id) on delete set null;
    end if;
  end if;

  if to_regclass('public.employee_payroll_fields') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_payroll_fields' and column_name = 'created_by'
  ) then
    alter table public.employee_payroll_fields
      alter column created_by drop not null,
      drop constraint if exists employee_payroll_fields_created_by_fkey,
      add constraint employee_payroll_fields_created_by_fkey
        foreign key (created_by) references public.users(id) on delete set null;
  end if;

  if to_regclass('public.employee_timekeeping_policies') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_timekeeping_policies' and column_name = 'pending_requested_by'
  ) then
    alter table public.employee_timekeeping_policies
      drop constraint if exists employee_timekeeping_policies_pending_requested_by_fkey,
      add constraint employee_timekeeping_policies_pending_requested_by_fkey
        foreign key (pending_requested_by) references auth.users(id) on delete set null;
  end if;
end;
$$;
