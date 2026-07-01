-- Create medical record access table for sharing records
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS medical_record_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  access_type TEXT DEFAULT 'view' CHECK (access_type IN ('view', 'edit')),
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE medical_record_access ENABLE ROW LEVEL SECURITY;

-- Policies for medical record access
CREATE POLICY "Users can manage their own record access" ON medical_record_access
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view granted access" ON medical_record_access
  FOR SELECT USING (auth.uid() = doctor_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_medical_record_access_record_id ON medical_record_access(record_id);
CREATE INDEX IF NOT EXISTS idx_medical_record_access_user_id ON medical_record_access(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_record_access_doctor_id ON medical_record_access(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_record_access_expires_at ON medical_record_access(expires_at);