-- ============================================================
-- Storage Buckets Setup
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create medical-records bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-records',
  'medical-records',
  false,
  20971520,  -- 20MB
  ARRAY['image/jpeg','image/png','image/jpg','application/pdf','image/*']
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 20971520,
  public = false;

-- 2. Create attachments bucket (chat)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'attachments',
  'attachments',
  true,   -- public so images display in chat
  10485760  -- 10MB
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  public = true;

-- 3. medical-records policies
DROP POLICY IF EXISTS "Auth users upload to medical-records" ON storage.objects;
DROP POLICY IF EXISTS "Auth users read medical-records" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete medical-records" ON storage.objects;

CREATE POLICY "Auth users upload to medical-records"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'medical-records' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users read medical-records"
ON storage.objects FOR SELECT
USING (bucket_id = 'medical-records' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users delete medical-records"
ON storage.objects FOR DELETE
USING (bucket_id = 'medical-records' AND auth.role() = 'authenticated');

-- 4. attachments (chat) policies
DROP POLICY IF EXISTS "Auth users upload to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone read attachments" ON storage.objects;

CREATE POLICY "Auth users upload to attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone read attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');
