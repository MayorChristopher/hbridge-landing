-- Hbridge - Clean Working Schema
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS hospital_affiliations CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS doctor_certifications CASCADE;
DROP TABLE IF EXISTS doctor_education CASCADE;
DROP TABLE IF EXISTS hospital_services CASCADE;
DROP TABLE IF EXISTS doctor_reviews CASCADE;
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS emergency_alerts CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS hospitals CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('patient', 'doctor', 'hospital_admin')),
    profile_image TEXT,
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    state VARCHAR(50),
    lga VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    medical_license VARCHAR(100),
    specialization VARCHAR(100),
    hospital_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false
);

-- Hospitals table
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('government', 'private', 'federal', 'state', 'teaching', 'specialist')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('general', 'pediatric', 'maternal', 'cardiovascular', 'orthopedic', 'psychiatric', 'oncology', 'emergency')),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    lga VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    website TEXT,
    emergency_services BOOLEAN DEFAULT false,
    has_ambulance BOOLEAN DEFAULT false,
    operating_hours JSONB,
    services JSONB,
    facilities JSONB,
    bed_capacity INTEGER,
    icu_beds INTEGER,
    emergency_beds INTEGER,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    images JSONB,
    description TEXT,
    established_year INTEGER,
    accreditation JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctors table
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    medical_license VARCHAR(100) UNIQUE NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    sub_specialization VARCHAR(100),
    years_experience INTEGER DEFAULT 0,
    medical_school VARCHAR(255),
    graduation_year INTEGER,
    consultation_fee DECIMAL(10,2) DEFAULT 0,
    bio TEXT,
    languages JSONB DEFAULT '["English"]',
    is_verified BOOLEAN DEFAULT false,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_date TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES profiles(id),
    average_rating DECIMAL(3,2) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    total_consultations INTEGER DEFAULT 0,
    smart_score DECIMAL(3,2) DEFAULT 0.0,
    is_available BOOLEAN DEFAULT true,
    profile_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Consultations table
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    consultation_type VARCHAR(20) NOT NULL CHECK (consultation_type IN ('audio', 'video', 'online', 'in_person', 'follow_up')),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    consultation_fee DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    symptoms TEXT,
    diagnosis TEXT,
    prescription TEXT,
    notes TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctor reviews table
CREATE TABLE doctor_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(doctor_id, patient_id, consultation_id)
);

-- Support tickets table
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES profiles(id),
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Anyone can view verified doctors" ON doctors FOR SELECT USING (verification_status = 'verified');
CREATE POLICY "Anyone can view active hospitals" ON hospitals FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view doctor reviews" ON doctor_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create doctor reviews" ON doctor_reviews FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Users can view their own data" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own data" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can create consultations" ON consultations FOR INSERT WITH CHECK (auth.uid() = patient_id OR EXISTS (SELECT 1 FROM doctors WHERE user_id = auth.uid() AND id = doctor_id));
CREATE POLICY "Users can view their own consultations" ON consultations FOR SELECT USING (auth.uid() = patient_id OR EXISTS (SELECT 1 FROM doctors WHERE user_id = auth.uid() AND id = doctor_id));
CREATE POLICY "Users can update their consultations" ON consultations FOR UPDATE USING (auth.uid() = patient_id);
CREATE POLICY "Doctors can update consultations" ON consultations FOR UPDATE USING (EXISTS (SELECT 1 FROM doctors WHERE user_id = auth.uid() AND id = doctor_id));
CREATE POLICY "Users can create support tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own support tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Insert sample hospitals
INSERT INTO hospitals (name, type, category, address, city, state, phone, emergency_services, has_ambulance, rating, total_reviews, description) VALUES
('Lagos University Teaching Hospital', 'teaching', 'general', 'Idi-Araba, Surulere', 'Lagos', 'Lagos', '+234-1-7747000', true, true, 4.2, 1250, 'Premier teaching hospital in Lagos'),
('National Hospital Abuja', 'federal', 'general', 'Central Business District', 'Abuja', 'FCT', '+234-9-4613000', true, true, 4.5, 890, 'Federal medical center'),
('Eko Hospital', 'private', 'general', 'Ikeja', 'Lagos', 'Lagos', '+234-1-2806300', true, true, 4.7, 2100, 'Leading private hospital'),
('UCH Ibadan', 'teaching', 'general', 'Queen Elizabeth Road', 'Ibadan', 'Oyo', '+234-2-2410088', true, true, 4.1, 980, 'Historic teaching hospital'),
('Federal Medical Centre Abuja', 'federal', 'general', 'Jabi District', 'Abuja', 'FCT', '+234-9-2902001', true, true, 4.0, 750, 'Federal medical center'),
('Reddington Hospital', 'private', 'general', 'Victoria Island', 'Lagos', 'Lagos', '+234-1-4617000', true, true, 4.8, 1800, 'Premium private hospital')
ON CONFLICT DO NOTHING;

-- Insert sample doctors
INSERT INTO doctors (full_name, medical_license, specialization, years_experience, consultation_fee, verification_status, bio, average_rating, total_reviews, is_available) VALUES
('Dr. Adebayo Johnson', 'MDCN001234', 'General Practice', 8, 15000, 'verified', 'Experienced general practitioner', 4.5, 120, true),
('Dr. Fatima Abdullahi', 'MDCN005678', 'Cardiology', 12, 35000, 'verified', 'Consultant cardiologist', 4.8, 89, true),
('Dr. Chinedu Okafor', 'MDCN009012', 'Pediatrics', 6, 18000, 'verified', 'Pediatric specialist', 4.7, 156, true),
('Dr. Aisha Mohammed', 'MDCN003456', 'Gynecology', 9, 25000, 'verified', 'Women health specialist', 4.6, 203, true),
('Dr. Olumide Adeyemi', 'MDCN007890', 'Orthopedics', 13, 30000, 'verified', 'Orthopedic surgeon', 4.4, 95, true),
('Dr. Grace Okoro', 'MDCN002468', 'Dermatology', 7, 20000, 'verified', 'Dermatologist', 4.9, 178, true)
ON CONFLICT DO NOTHING;pe, category, address, city, state, phone, emergency_services, has_ambulance, rating, total_reviews, description) VALUES
('Lagos University Teaching Hospital', 'teaching', 'general', 'Idi-Araba, Surulere', 'Lagos', 'Lagos', '+234-1-7747000', true, true, 4.2, 1250, 'Premier teaching hospital in Lagos'),
('National Hospital Abuja', 'federal', 'general', 'Central Business District', 'Abuja', 'FCT', '+234-9-4613000', true, true, 4.5, 890, 'Federal medical center'),
('Eko Hospital', 'private', 'general', 'Ikeja', 'Lagos', 'Lagos', '+234-1-2806300', true, true, 4.7, 2100, 'Leading private hospital'),
('UCH Ibadan', 'teaching', 'general', 'Queen Elizabeth Road', 'Ibadan', 'Oyo', '+234-2-2410088', true, true, 4.1, 980, 'Historic teaching hospital'),
('Federal Medical Centre Abuja', 'federal', 'general', 'Jabi District', 'Abuja', 'FCT', '+234-9-2902001', true, true, 4.0, 750, 'Federal medical center'),
('Reddington Hospital', 'private', 'general', 'Victoria Island', 'Lagos', 'Lagos', '+234-1-4617000', true, true, 4.8, 1800, 'Premium private hospital')
ON CONFLICT DO NOTHING;

-- Add missing smart_score column to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS smart_score DECIMAL(3,2) DEFAULT 0.0;

-- Update existing doctors with default smart scores
UPDATE doctors SET smart_score = average_rating WHERE smart_score IS NULL OR smart_score = 0;

-- Insert sample doctors
INSERT INTO doctors (full_name, medical_license, specialization, years_experience, consultation_fee, verification_status, bio, average_rating, total_reviews, languages) VALUES
('Adebayo Johnson', 'MDCN001234', 'General Practice', 8, 15000, 'verified', 'Experienced general practitioner', 4.5, 120, '["English", "Yoruba"]'),
('Fatima Abdullahi', 'MDCN005678', 'Cardiology', 12, 35000, 'verified', 'Consultant cardiologist', 4.8, 89, '["English", "Hausa"]'),
('Chinedu Okafor', 'MDCN009012', 'Pediatrics', 6, 18000, 'verified', 'Pediatric specialist', 4.7, 156, '["English", "Igbo"]'),
('Aisha Mohammed', 'MDCN003456', 'Gynecology', 9, 25000, 'verified', 'Women health specialist', 4.6, 203, '["English", "Hausa"]'),
('Olumide Adeyemi', 'MDCN007890', 'Orthopedics', 13, 30000, 'verified', 'Orthopedic surgeon', 4.4, 95, '["English", "Yoruba"]'),
('Grace Okoro', 'MDCN002468', 'Dermatology', 7, 20000, 'verified', 'Dermatologist', 4.9, 178, '["English", "Igbo"]')
ON CONFLICT DO NOTHING;