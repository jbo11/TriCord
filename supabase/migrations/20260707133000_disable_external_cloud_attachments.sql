-- Release decision: files over 20 MB fail immediately in TriCord.
-- Users should share Google Drive, Dropbox, OneDrive, or other cloud links in messages instead.

drop policy if exists "Users upload accessible external attachments" on public.attachments;

alter table public.attachments drop constraint if exists attachments_file_size_release_check;
alter table public.attachments add constraint attachments_file_size_release_check check (
  bucket <> 'external-cloud'
  and byte_size between 1 and 20971520
);

comment on table public.attachments is 'Attachment metadata. TriCord direct uploads are limited to 20 MB per file for this release. Larger files should be shared as cloud-storage links in messages.';
