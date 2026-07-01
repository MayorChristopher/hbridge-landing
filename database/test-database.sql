-- Database Test Script
-- Run this in Supabase SQL Editor to test database connectivity

-- Test 1: Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'doctors', 'hospitals', 'medical_records', 'medical_record_access');

-- Test 2: Check profiles table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Test 3: Check medical_records table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'medical_records' 
ORDER BY ordinal_position;

-- Test 4: Check if sample data exists
SELECT 'hospitals' as table_name, COUNT(*) as count FROM hospitals
UNION ALL
SELECT 'doctors' as table_name, COUNT(*) as count FROM doctors
UNION ALL
SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles;

-- Test 5: Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('profiles', 'doctors', 'hospitals', 'medical_records');