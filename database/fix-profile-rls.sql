-- Allow any authenticated user to read profiles (needed for messaging/doctor search)
DROP POLICY IF EXISTS "Users can view profiles of conversation partners" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;

CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');
