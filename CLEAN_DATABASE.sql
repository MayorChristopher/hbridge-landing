-- ============================================================
-- HBRIDGE — FULL DATABASE RESET + SCHEMA FIX
-- Run this in your Supabase SQL Editor (supabase.com dashboard)
-- ============================================================


-- ============================================================
-- STEP 1: Wipe all app data (skips tables that don't exist)
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'analytics_events',
    'attachments',
    'doctor_availability',
    'doctor_licenses',
    'doctor_reviews',
    'error_reports',
    'medical_record_access',
    'medical_records',
    'messages',
    'notifications',
    'payments',
    'privacy_settings',
    'ratings',
    'record_folders',
    'record_transfers',
    'reviews',
    'subscriptions',
    'support_tickets',
    'user_analytics',
    'user_push_tokens',
    'vitals',
    'consultations',
    'conversations',
    'doctors',
    'hospitals',
    'profiles'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE 'TRUNCATE TABLE ' || quote_ident(tbl) || ' CASCADE';
      RAISE NOTICE 'Truncated: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (does not exist): %', tbl;
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- STEP 2: Delete all auth users
-- Option A (recommended): Supabase Dashboard →
--   Authentication → Users → select all → Delete
--
-- Option B: run the line below (needs service_role privileges)
-- ============================================================
DELETE FROM auth.users;


-- ============================================================
-- STEP 3: Fix missing columns in profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_plan     TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status   TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS nma_number            TEXT,
  ADD COLUMN IF NOT EXISTS secondary_specialty   TEXT,
  ADD COLUMN IF NOT EXISTS consultation_types    TEXT[],
  ADD COLUMN IF NOT EXISTS availability_days     TEXT[];


-- ============================================================
-- STEP 4: Verify — counts all existing public tables (should all be 0)
-- ============================================================
SELECT
  table_name,
  (xpath('/row/c/text()',
    query_to_xml(
      'SELECT COUNT(*) AS c FROM ' || quote_ident(table_name),
      false, true, ''
    )
  ))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
