-- Fix Storage RLS Policy for 'profiles' bucket
-- Run this in Supabase SQL Editor

-- Allow authenticated users to upload to profiles bucket
CREATE POLICY "Authenticated users can upload to profiles bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profiles');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update profiles bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profiles');

-- Allow public read access (since bucket is public)
CREATE POLICY "Public can view profiles bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profiles');

-- Allow users to delete from profiles bucket
CREATE POLICY "Authenticated users can delete from profiles bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profiles');
