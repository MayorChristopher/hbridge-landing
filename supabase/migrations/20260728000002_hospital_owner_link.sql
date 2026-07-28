-- Root-fixes the "same account, doctor + hospital admin" profile conflict:
-- hospitals had no real link to the account that administers them, only a
-- fragile profiles.hospital_name string match — and nothing ever created a
-- hospital_staff row for an admin who is also a practitioner at their own
-- facility, so they'd see their own hospital as unaffiliated and have to
-- "request to join" themselves.
alter table public.hospitals add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
create index if not exists hospitals_owner_user_id_idx on public.hospitals(owner_user_id);

drop policy if exists "Hospital admins can update their hospital" on public.hospitals;
create policy "Hospital admins can update their hospital"
  on public.hospitals
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and lower(profiles.hospital_name) = lower(hospitals.name))
  )
  with check (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and lower(profiles.hospital_name) = lower(hospitals.name))
  );

drop policy if exists "hospital_admin_manage_staff" on public.hospital_staff;
create policy "hospital_admin_manage_staff"
  on public.hospital_staff
  for all
  to public
  using (
    exists (
      select 1 from hospitals h
      where h.id = hospital_staff.hospital_id
        and (
          h.owner_user_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and lower(p.hospital_name) = lower(h.name))
        )
    )
  );
