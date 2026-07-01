-- Fix medical_records table - use user_id instead of patient_id
-- Run this in Supabase SQL Editor

-- Drop existing table if it exists
DROP TABLE IF EXISTS medical_records CASCADE;

-- Create medical_records table with correct references
CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('diagnosis', 'prescription', 'lab_result', 'imaging', 'vaccination', 'allergy', 'surgery', 'other', 'vital_signs')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagnosis TEXT,
    prescription TEXT,
    lab_results JSONB,
    attachments JSONB,
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical_records
CREATE POLICY "Users can view their own medical records" 
ON medical_records FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view their patients' records" 
ON medical_records FOR SELECT 
USING (EXISTS (SELECT 1 FROM doctors WHERE user_id = auth.uid() AND id = doctor_id));

CREATE POLICY "Users can create their own medical records" 
ON medical_records FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Doctors can create medical records for their patients" 
ON medical_records FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM doctors WHERE user_id = auth.uid() AND id = doctor_id));

CREATE POLICY "Users can update their own medical records" 
ON medical_records FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Doctors can update their patients' records" 
ON medical_records FOR UPDATE 
USING (EXISTS (SELECT 1 FROM doctors WHERE user_id = auth.uid() AND id = doctor_id));