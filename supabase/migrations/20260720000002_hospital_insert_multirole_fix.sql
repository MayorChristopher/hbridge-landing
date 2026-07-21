-- The "Hospital admins can create hospital records" policy (20260719000004)
-- checked profiles.user_type = 'hospital_admin' -- but this app supports
-- multi-role accounts via profiles.user_types (a plural array); adding
-- hospital_admin as a SECOND role only ever updates user_types, never the
-- original singular user_type column (see SignUpScreen.tsx's add-role flow).
-- So any account that added hospital_admin as a secondary role was silently
-- rejected on every hospital profile save. Check both columns.

drop policy if exists "Hospital admins can create hospital records" on hospitals;

create policy "Hospital admins can create hospital records"
  on hospitals for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (
          profiles.user_type = 'hospital_admin'
          or 'hospital_admin' = any(profiles.user_types)
        )
    )
  );
