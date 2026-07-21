-- hospital_staff has had RLS enabled with ZERO policies since it was created
-- (not something added this session) -- in Postgres that silently denies ALL
-- access to every normal role. This is the root cause of "inviting staff
-- doesn't work," and also silently broke the hospital-affiliation checks
-- added in the prescription policy (20260719000006) and shifts/team-chat
-- policies (20260719000008), since those policies read hospital_staff too.

drop policy if exists "hospital_admin_manage_staff" on hospital_staff;
create policy "hospital_admin_manage_staff"
  on hospital_staff for all
  using (
    exists (
      select 1 from hospitals h
      join profiles p on p.id = auth.uid()
      where h.id = hospital_staff.hospital_id
        and lower(p.hospital_name) = lower(h.name)
    )
  );

drop policy if exists "doctor_manage_own_staff_row" on hospital_staff;
create policy "doctor_manage_own_staff_row"
  on hospital_staff for all
  using (
    exists (select 1 from doctors d where d.id = hospital_staff.doctor_id and d.user_id = auth.uid())
  )
  with check (
    exists (select 1 from doctors d where d.id = hospital_staff.doctor_id and d.user_id = auth.uid())
  );
