-- The live Supabase security advisor (npx supabase db advisors --linked) surfaced
-- two storage buckets left over from earlier ad-hoc setup scripts
-- (database/create-storage.sql, storage-setup.sql, fix-storage-policy.sql,
-- storage-buckets.sql) that no current client code writes to or reads from
-- (superseded by "attachments"/"avatars" from the prior migration), but which
-- were still public with broad "anyone can list/read" policies:
--   - "medical-records" (medical_records_public_select: anyone, incl. anon)
--   - "profiles" (multiple overlapping public-read policies)
-- Neither is referenced anywhere in src/, so this is a pure lockdown with no
-- app behavior change.

update storage.buckets set public = false where id in ('medical-records', 'profiles');

drop policy if exists "medical_records_public_select" on storage.objects;
drop policy if exists "Auth users read medical-records" on storage.objects;
drop policy if exists "Auth users upload to medical-records" on storage.objects;
drop policy if exists "Auth users delete medical-records" on storage.objects;
drop policy if exists "Authenticated users upload medical records" on storage.objects;
drop policy if exists "Users view own medical records" on storage.objects;
drop policy if exists "medical_records_auth_upload" on storage.objects;
drop policy if exists "medical_records_owner_delete" on storage.objects;

drop policy if exists "Anyone can view profile images" on storage.objects;
drop policy if exists "Public can view profiles bucket" on storage.objects;
drop policy if exists "Users can upload their own profile images" on storage.objects;
drop policy if exists "Users can update their own profile images" on storage.objects;
drop policy if exists "Users can delete their own profile images" on storage.objects;
drop policy if exists "Authenticated users can upload to profiles bucket" on storage.objects;
drop policy if exists "Authenticated users can update profiles bucket" on storage.objects;
drop policy if exists "Authenticated users can delete from profiles bucket" on storage.objects;
