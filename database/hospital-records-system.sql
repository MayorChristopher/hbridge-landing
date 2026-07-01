-- ============================================================
-- Medical Records: Hospital Folder System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add hospital_id to medical_records (links record to a hospital folder)
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS attachment_url TEXT;

CREATE INDEX IF NOT EXISTS idx_medical_records_hospital_id ON medical_records(hospital_id);

-- 2. Allow hospitals to insert records for patients
DROP POLICY IF EXISTS "Hospitals can create patient records" ON medical_records;
CREATE POLICY "Hospitals can create patient records"
ON medical_records FOR INSERT WITH CHECK (true);

-- 3. Ensure medical_record_access table exists (for sharing/transfers)
CREATE TABLE IF NOT EXISTS medical_record_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    access_type VARCHAR(20) DEFAULT 'view' CHECK (access_type IN ('view', 'edit', 'full')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE medical_record_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can manage their record access" ON medical_record_access;
DROP POLICY IF EXISTS "Doctors can view their access grants" ON medical_record_access;

CREATE POLICY "Patients can manage their record access"
ON medical_record_access FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can view their access grants"
ON medical_record_access FOR SELECT USING (
    EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = auth.uid() AND d.id = doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_record_access_patient ON medical_record_access(patient_id);
CREATE INDEX IF NOT EXISTS idx_record_access_doctor ON medical_record_access(doctor_id);
CREATE INDEX IF NOT EXISTS idx_record_access_hospital ON medical_record_access(hospital_id);

-- 4. Storage bucket for medical records (run once in Supabase Dashboard > Storage)
-- Bucket name: medical-records
-- Public: false
-- File size limit: 20MB
-- ============================================================
