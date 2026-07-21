-- Locks down the "attachments" bucket, which held medical records, doctor
-- case files, and chat attachments as world-readable public files (any of
-- database/storage-buckets.sql, create-storage.sql, storage-setup.sql,
-- fix-storage-policy.sql set it public with no owner check). This migration
-- supersedes those ad-hoc scripts for the "attachments" bucket.
--
-- Profile photos move to a new, separate "avatars" bucket that stays public
-- (low sensitivity, displayed in many list views) so avatar rendering needs
-- no signed-URL machinery.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'attachments';

-- Exact names as created by database/storage-buckets.sql (the live policies).
drop policy if exists "Anyone read attachments" on storage.objects;
drop policy if exists "Auth users upload to attachments" on storage.objects;

-- No SELECT policy is added: reads only happen via the get-record-url edge
-- function's service-role client, which bypasses RLS entirely by design.
--
-- Uploads are scoped to two known path conventions used by the app:
--   records/{user_id}/...        (medical records, case files)
--   chat/{conversation_id}/...   (chat attachments)
drop policy if exists "attachments_insert_own" on storage.objects;
create policy "attachments_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and (
      (
        (storage.foldername(name))[1] = 'records'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'chat'
        and exists (
          select 1 from conversations c
          left join doctors d on d.id = c.doctor_id
          where c.id::text = (storage.foldername(name))[2]
            and (c.patient_id = auth.uid() or d.user_id = auth.uid())
        )
      )
    )
  );

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'avatars');
