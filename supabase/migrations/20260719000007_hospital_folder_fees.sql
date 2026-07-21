-- Paid hospital record-folder creation. A fee of 0 (the default) preserves
-- today's free/instant folder creation for every hospital until an admin
-- opts in by setting a real fee. Doctor/personal folders are unaffected.

alter table hospitals
  add column if not exists folder_creation_fee numeric(10, 2) not null default 0;

alter table record_folders
  add column if not exists folder_number text,
  add column if not exists payment_reference text unique;

create table if not exists hospital_folder_counters (
  hospital_id uuid primary key references hospitals(id) on delete cascade,
  next_number int not null default 1
);

-- Atomically hands out the next folder number for a hospital. Only ever
-- called by the paystack-verify edge function (service role).
create or replace function assign_folder_number(p_hospital_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned int;
begin
  insert into hospital_folder_counters (hospital_id, next_number)
  values (p_hospital_id, 2)
  on conflict (hospital_id) do update set next_number = hospital_folder_counters.next_number + 1
  returning next_number - 1 into assigned;
  return assigned;
end;
$$;

-- Needed so hospital staff can look a patient up by folder number: lets a
-- hospital_admin SELECT folders linked to their own hospital only (same
-- profiles.hospital_name / hospitals.name match already used by the live
-- "Hospital admins can update their hospital" policy) -- doctor/personal
-- folders and other hospitals' folders remain invisible to them.
drop policy if exists "hospital_admin_view_own_hospital_folders" on record_folders;
create policy "hospital_admin_view_own_hospital_folders"
  on record_folders for select
  using (
    folder_type = 'hospital'
    and exists (
      select 1 from hospitals h
      join profiles p on p.id = auth.uid()
      where h.id = record_folders.linked_id
        and lower(p.hospital_name) = lower(h.name)
    )
  );
