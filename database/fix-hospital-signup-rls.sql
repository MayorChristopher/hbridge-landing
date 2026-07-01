-- Fix profile RLS so all user types (including hospital_admin) can write their profile
-- Run this in Supabase SQL Editor

-- Drop and recreate all profile policies cleanly
DROP POLICY IF EXISTS "Users can insert their own data" ON profiles;
DROP POLICY IF EXISTS "Users can update their own data" ON profiles;
DROP POLICY IF EXISTS "Users can view their own data" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles of conversation partners" ON profiles;

-- SELECT: any authenticated user can read all profiles
CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: user can only insert their own row
CREATE POLICY "Users can insert their own data" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: user can only update their own row
CREATE POLICY "Users can update their own data" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
