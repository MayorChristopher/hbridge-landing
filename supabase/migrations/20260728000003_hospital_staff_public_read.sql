-- Patients viewing a doctor's profile need to see which hospital(s) they're
-- confirmed active staff at (this is what DoctorDetailScreen's new "Practicing
-- at" section reads). The existing hospital_staff policies only let the
-- doctor themselves or the hospital admin themselves see rows — there was no
-- path for a third-party patient to see this public-facing fact at all.
-- Scoped to status = 'active' only: pending requests, invites, and resigned
-- history stay visible only to the two parties involved, never publicly.
create policy "public_read_active_staff"
  on public.hospital_staff
  for select
  to public
  using (status = 'active');
