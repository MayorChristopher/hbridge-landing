-- ============================================================
-- Record Folders + Sharing System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. record_folders
CREATE TABLE IF NOT EXISTS record_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    folder_type VARCHAR(20) NOT NULL DEFAULT 'personal'
        CHECK (folder_type IN ('hospital','doctor','personal')),
    linked_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow duplicate linked_id across different owners but unique per owner
CREATE UNIQUE INDEX IF NOT EXISTS idx_record_folders_owner_linked
ON record_folders(owner_id, linked_id) WHERE linked_id IS NOT NULL;

ALTER TABLE record_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own folders" ON record_folders;
CREATE POLICY "Users manage own folders"
ON record_folders FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_record_folders_owner ON record_folders(owner_id);

-- 2. medical_records columns
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES record_folders(id) ON DELETE SET NULL;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medical_records_folder_id ON medical_records(folder_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_user_id ON medical_records(user_id);

-- 3. RLS on medical_records
DROP POLICY IF EXISTS "Patients insert own records" ON medical_records;
DROP POLICY IF EXISTS "Patients view own records" ON medical_records;
DROP POLICY IF EXISTS "Patients delete own records" ON medical_records;
DROP POLICY IF EXISTS "Doctors view shared records" ON medical_records;

CREATE POLICY "Patients view own records"
ON medical_records FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Patients insert own records"
ON medical_records FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Patients delete own records"
ON medical_records FOR DELETE USING (auth.uid() = user_id);

-- Doctors can view records shared with them
CREATE POLICY "Doctors view shared records"
ON medical_records FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM medical_record_access mra
        JOIN doctors d ON d.id = mra.doctor_id
        WHERE mra.record_id = medical_records.id
        AND d.user_id = auth.uid()
        AND mra.is_active = true
    )
);

-- 4. medical_record_access
CREATE TABLE IF NOT EXISTS medical_record_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    access_type VARCHAR(20) DEFAULT 'view',
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE medical_record_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients manage their record access" ON medical_record_access;
DROP POLICY IF EXISTS "Doctors view granted access" ON medical_record_access;

CREATE POLICY "Patients manage their record access"
ON medical_record_access FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Doctors view granted access"
ON medical_record_access FOR SELECT USING (
    EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = auth.uid() AND d.id = doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_mra_patient ON medical_record_access(patient_id);
CREATE INDEX IF NOT EXISTS idx_mra_doctor ON medical_record_access(doctor_id);
CREATE INDEX IF NOT EXISTS idx_mra_hospital ON medical_record_access(hospital_id);
CREATE INDEX IF NOT EXISTS idx_mra_record ON medical_record_access(record_id);

-- 5. Storage bucket: create manually in Supabase Dashboard > Storage
-- Name: medical-records | Public: false | Max size: 20MB

-- Storage RLS policies for medical-records bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('medical-records', 'medical-records', false, 20971520)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users upload medical records" ON storage.objects;
DROP POLICY IF EXISTS "Users view own medical records" ON storage.objects;

CREATE POLICY "Authenticated users upload medical records"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'medical-records' AND auth.role() = 'authenticated');

CREATE POLICY "Users view own medical records"
ON storage.objects FOR SELECT
USING (bucket_id = 'medical-records' AND auth.role() = 'authenticated');
