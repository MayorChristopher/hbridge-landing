-- Add missing columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(10,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_experience INTEGER;

-- Create reviews table that matches the app usage
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(doctor_id, patient_id, consultation_id)
);

-- Enable RLS on reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for reviews
CREATE POLICY IF NOT EXISTS "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Patients can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Create conversations and messages tables if they don't exist
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(patient_id, doctor_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT,
    attachment_type VARCHAR(20) CHECK (attachment_type IN ('image', 'file')),
    attachment_name VARCHAR(255),
    attachment_size VARCHAR(50),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on conversations and messages
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for conversations and messages
CREATE POLICY IF NOT EXISTS "Users can view their conversations" ON conversations FOR SELECT USING (
    auth.uid() = patient_id OR 
    auth.uid() IN (SELECT user_id FROM doctors WHERE id = doctor_id)
);

CREATE POLICY IF NOT EXISTS "Users can create conversations" ON conversations FOR INSERT WITH CHECK (
    auth.uid() = patient_id OR 
    auth.uid() IN (SELECT user_id FROM doctors WHERE id = doctor_id)
);

CREATE POLICY IF NOT EXISTS "Users can update conversations" ON conversations FOR UPDATE USING (
    auth.uid() = patient_id OR 
    auth.uid() IN (SELECT user_id FROM doctors WHERE id = doctor_id)
);

CREATE POLICY IF NOT EXISTS "Users can view messages in their conversations" ON messages FOR SELECT USING (
    conversation_id IN (
        SELECT id FROM conversations WHERE 
        patient_id = auth.uid() OR 
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
    )
);

CREATE POLICY IF NOT EXISTS "Users can create messages" ON messages FOR INSERT WITH CHECK (
    conversation_id IN (
        SELECT id FROM conversations WHERE 
        patient_id = auth.uid() OR 
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
    )
);

CREATE POLICY IF NOT EXISTS "Users can update their own messages" ON messages FOR UPDATE USING (
    sender_id = auth.uid()
);

-- Create vitals table if it doesn't exist
CREATE TABLE IF NOT EXISTS vitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    heart_rate INTEGER,
    blood_pressure VARCHAR(20),
    temperature DECIMAL(4,1),
    oxygen_saturation INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own vitals" ON vitals FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY IF NOT EXISTS "Users can create their own vitals" ON vitals FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Allow doctors to insert/update their own rows
CREATE POLICY IF NOT EXISTS "Doctors can insert their own data" ON doctors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Doctors can update their own data" ON doctors FOR UPDATE USING (auth.uid() = user_id);