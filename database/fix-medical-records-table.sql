-- Update medical_records table to match service expectations
-- Run this in Supabase SQL Editor

-- Drop and recreate medical_records table with correct structure
DROP TABLE IF EXISTS medical_records CASCADE;

CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('diagnosis', 'prescription', 'lab_result', 'imaging', 'vital_signs', 'allergy', 'vaccination')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB,
    attachments JSONB,
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own medical records" 
ON medical_records FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view shared records" 
ON medical_records FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM medical_record_access 
    WHERE record_id = medical_records.id 
    AND doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
    AND is_active = true
));

CREATE POLICY "Users can create their own medical records" 
ON medical_records FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medical records" 
ON medical_records FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medical records" 
ON medical_records FOR DELETE 
USING (auth.uid() = user_id);

-- Insert sample medical records
INSERT INTO medical_records (user_id, record_type, title, description, data, is_sensitive) 
SELECT 
    id as user_id,
    'lab_result' as record_type,
    'Blood Test Results' as title,
    'Complete blood count and metabolic panel' as description,
    '{"hemoglobin": "12.5 g/dL", "glucose": "95 mg/dL", "cholesterol": "180 mg/dL"}' as data,
    false as is_sensitive
FROM profiles 
WHERE user_type = 'patient' 
LIMIT 1;

INSERT INTO medical_records (user_id, record_type, title, description, data, is_sensitive) 
SELECT 
    id as user_id,
    'prescription' as record_type,
    'Prescription - Antibiotics' as title,
    'Amoxicillin for bacterial infection' as description,
    '{"medication": "Amoxicillin", "dosage": "500mg", "frequency": "3 times daily", "duration": "7 days"}' as data,
    true as is_sensitive
FROM profiles 
WHERE user_type = 'patient' 
LIMIT 1;

-- Add indexes for performance
CREATE INDEX idx_medical_records_user_id ON medical_records(user_id);
CREATE INDEX idx_medical_records_type ON medical_records(record_type);
CREATE INDEX idx_medical_records_created ON medical_records(created_at DESC);