-- Real practitioner verification. Previously every doctor signup/profile-edit
-- client-side set verification_status='verified' unconditionally, and the
-- live "Doctors can update own row" RLS policy has no column restriction —
-- meaning a doctor could set their own verification_status via the API
-- directly even after the client stops doing it. This migration closes that
-- at the database level; review itself happens via the Supabase dashboard
-- (elevated access, unaffected by the trigger below).

alter table doctors
  add column if not exists verification_notes text;

alter table doctors
  alter column verification_status set default 'pending';

create or replace function protect_doctor_verification_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.verification_status := old.verification_status;
    new.verification_notes := old.verification_notes;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_doctor_verification on doctors;
create trigger trg_protect_doctor_verification
  before update on doctors
  for each row
  execute function protect_doctor_verification_columns();

-- Extend the attachments bucket's owner-scoped upload policy (from
-- 20260719000002_lock_attachments_bucket.sql) to also allow license
-- documents under licenses/{user_id}/..., alongside the existing
-- records/{user_id}/... and chat/{conversation_id}/... prefixes.
drop policy if exists "attachments_insert_own" on storage.objects;
create policy "attachments_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and (
      (
        (storage.foldername(name))[1] in ('records', 'licenses')
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
