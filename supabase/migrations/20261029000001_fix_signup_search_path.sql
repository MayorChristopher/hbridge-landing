-- Fix: new sign-ups fail with "Database error saving new user".
-- Supabase Auth inserts into auth.users with search_path = auth. The
-- on_auth_user_created trigger (handle_new_user) inserts into public.profiles,
-- which fires trg_profile_hbridge_id -> set_profile_hbridge_id(), which calls
-- generate_hbridge_id() unqualified. Under search_path = auth that function
-- (and the profiles/hospitals tables it reads) can't be resolved, so the whole
-- sign-up transaction aborts. Pinning search_path on every function in the
-- chain makes them resolve regardless of the caller's search_path.
alter function public.generate_hbridge_id(text) set search_path = public;
alter function public.set_profile_hbridge_id() set search_path = public;
alter function public.set_hospital_hbridge_id() set search_path = public;
alter function public.handle_new_user() set search_path = public;
