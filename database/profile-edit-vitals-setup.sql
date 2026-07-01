-- ============================================================
-- Hbridge: Profile Edit + Vitals + Appointments + Records Fix
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add missing columns to profiles (safe - skips if already exist)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_pin VARCHAR(10);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"push":true,"email":false,"sms":true,"sound":true}'::jsonb;

-- 2. Create appointments table (if not exists)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    appointment_type VARCHAR(30) DEFAULT 'in_person' CHECK (appointment_type IN ('in_person', 'video', 'audio', 'follow_up')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- RLS for appointments
DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can update own appointments" ON appointments;

CREATE POLICY "Patients can view own appointments"
ON appointments FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create appointments"
ON appointments FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update own appointments"
ON appointments FOR UPDATE USING (auth.uid() = patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- 3. Create vitals table (if not exists)
CREATE TABLE IF NOT EXISTS vitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    heart_rate INTEGER,                    -- BPM
    blood_pressure VARCHAR(10),            -- e.g. "120/80"
    temperature DECIMAL(4,1),              -- Celsius
    oxygen_saturation INTEGER,             -- SpO2 %
    weight DECIMAL(5,1),                   -- kg
    height DECIMAL(5,1),                   -- cm
    blood_glucose DECIMAL(5,1),            -- mg/dL
    recorded_by UUID REFERENCES profiles(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

-- RLS for vitals
DROP POLICY IF EXISTS "Patients can view own vitals" ON vitals;
DROP POLICY IF EXISTS "Patients can insert own vitals" ON vitals;
DROP POLICY IF EXISTS "Doctors can view patient vitals" ON vitals;

CREATE POLICY "Patients can view own vitals"
ON vitals FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert own vitals"
ON vitals FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view patient vitals"
ON vitals FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN doctors d ON d.id = c.doctor_id
        WHERE c.patient_id = vitals.patient_id
        AND d.user_id = auth.uid()
    )
);

CREATE INDEX IF NOT EXISTS idx_vitals_patient_id ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at DESC);

-- 4. Ensure medical_records has patient_id alias support
--    (The app uses user_id; this adds patient_id as an alias column for ProfileScreen counts)
--    medical_records already uses user_id — the app code has been updated to match.
--    No column change needed.

-- 5. Allow doctors to insert vitals for their patients
DROP POLICY IF EXISTS "Doctors can insert patient vitals" ON vitals;
CREATE POLICY "Doctors can insert patient vitals"
ON vitals FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM doctors d WHERE d.user_id = auth.uid()
    )
);

-- ============================================================
-- Optional: seed a test vital for your account (replace UUID)
-- INSERT INTO vitals (patient_id, heart_rate, blood_pressure, temperature, oxygen_saturation)
-- VALUES ('<your-profile-uuid>', 72, '120/80', 36.6, 98);
-- ============================================================
