-- Profile Screen Updates - Database Migrations
-- Run this in Supabase SQL Editor

-- Add is_premium column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Add medical_pin column to profiles table (for medical records protection)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_pin VARCHAR(10);

-- Create medical_records table
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('lab_results', 'prescriptions', 'vitals', 'scans_images', 'other')),
    file_url TEXT,
    file_type VARCHAR(50),
    file_size INTEGER,
    description TEXT,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on medical_records
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical_records
CREATE POLICY "Users can view their own medical records" 
ON medical_records FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own medical records" 
ON medical_records FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medical records" 
ON medical_records FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medical records" 
ON medical_records FOR DELETE 
USING (auth.uid() = user_id);

-- Doctors can view medical records of their patients (if they have consultations)
CREATE POLICY "Doctors can view patient medical records" 
ON medical_records FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.patient_id = medical_records.user_id
        AND d.user_id = auth.uid()
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medical_records_user_id ON medical_records(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_category ON medical_records(category);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at ON medical_records(created_at DESC);

-- Update existing users to have default medical PIN (optional - for testing)
-- UPDATE profiles SET medical_pin = '1234' WHERE medical_pin IS NULL;

-- Create storage bucket for profile images (run in Supabase Dashboard > Storage)
-- Bucket name: profile-images
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/jpg

-- Create storage bucket for medical records (run in Supabase Dashboard > Storage)
-- Bucket name: medical-records
-- Public: false (private)
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, application/pdf

-- Storage policies for profile-images bucket
-- CREATE POLICY "Users can upload their own profile images"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Anyone can view profile images"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'profile-images');

-- CREATE POLICY "Users can update their own profile images"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete their own profile images"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for medical-records bucket
-- CREATE POLICY "Users can upload their own medical records"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view their own medical records"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete their own medical records"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);

COMMENT ON TABLE medical_records IS 'Stores user medical records and documents';
COMMENT ON COLUMN profiles.is_premium IS 'Indicates if user has premium subscription';
COMMENT ON COLUMN profiles.medical_pin IS 'PIN for accessing medical records (encrypted in production)';
