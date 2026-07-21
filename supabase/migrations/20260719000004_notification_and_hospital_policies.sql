-- Found via `npx supabase db advisors --linked` against the live project.
--
-- 1. "notifications" had a second, separately-added INSERT policy
--    ("System can create notifications", WITH CHECK (true), role public) that
--    let anyone insert a notification claiming any user_id — full spoofing.
--    The existing "ntf_owner_all" policy already covers legitimate self-inserts
--    (auth.uid() = user_id), so dropping this is a pure lockdown; cross-user
--    notifications now go through the create-notification edge function
--    (service role bypasses RLS after checking real relationships).
drop policy if exists "System can create notifications" on notifications;

-- 2. "hospitals" INSERT was WITH CHECK (true) for any authenticated user.
--    Every insert call site in the app is already client-gated to
--    hospital_admin signup/profile flows; this just makes the database
--    enforce what the client already assumes.
drop policy if exists "Authenticated users can create hospital records" on hospitals;

create policy "Hospital admins can create hospital records"
  on hospitals for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.user_type = 'hospital_admin'
    )
  );
