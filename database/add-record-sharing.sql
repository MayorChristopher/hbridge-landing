-- Add medical record sharing table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS medical_record_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'edit', 'temporary')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE medical_record_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Patients can manage their record access" 
ON medical_record_access FOR ALL 
USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can view granted access" 
ON medical_record_access FOR SELECT 
USING (EXISTS (SELECT 1 FROM doctors WHERE user_id = auth.uid() AND id = doctor_id));

-- Index for performance
CREATE INDEX idx_medical_record_access_patient ON medical_record_access(patient_id);
CREATE INDEX idx_medical_record_access_doctor ON medical_record_access(doctor_id);
CREATE INDEX idx_medical_record_access_record ON medical_record_access(record_id);