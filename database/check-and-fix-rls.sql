-- ============================================================
-- Run this in Supabase SQL Editor to diagnose data issues
-- ============================================================

-- 1. Check how many rows exist
SELECT 'hospitals' as table_name, COUNT(*) as row_count FROM hospitals
UNION ALL
SELECT 'doctors', COUNT(*) FROM doctors
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles;

-- 2. Check hospitals are active
SELECT id, name, type, city, state, is_active, rating FROM hospitals LIMIT 5;

-- 3. Check doctors are verified
SELECT id, full_name, specialization, verification_status, is_available FROM doctors LIMIT 5;

-- 4. Check RLS policies on hospitals
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'hospitals';

-- 5. Check RLS policies on doctors  
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'doctors';

-- 6. Fix: ensure anon role can SELECT hospitals and doctors
-- (Run these if the above queries show 0 rows when logged in as anon)
DROP POLICY IF EXISTS "Anyone can view active hospitals" ON hospitals;
DROP POLICY IF EXISTS "Anyone can view verified doctors" ON doctors;

CREATE POLICY "Anyone can view active hospitals" ON hospitals
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view verified doctors" ON doctors
  FOR SELECT USING (verification_status = 'verified');

-- 7. Also allow anon to read ALL hospitals/doctors (for debugging)
-- Remove this after confirming data loads
CREATE POLICY "Public read hospitals" ON hospitals
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read doctors" ON doctors
  FOR SELECT TO anon USING (true);

-- 8. Verify counts again after policy fix
SELECT 'hospitals_visible' as check_name, COUNT(*) FROM hospitals WHERE is_active = true
UNION ALL
SELECT 'doctors_visible', COUNT(*) FROM doctors WHERE verification_status = 'verified';