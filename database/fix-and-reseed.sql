-- ============================================================
-- Hbridge - Fix & Reseed Script
-- Run this in Supabase SQL Editor to fix data issues
-- ============================================================

-- 1. Clear existing sample data (keeps schema intact)
DELETE FROM doctor_reviews;
DELETE FROM consultations;
DELETE FROM doctors;
DELETE FROM hospitals;

-- 2. Add latitude/longitude columns if they don't exist
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- 3. Insert hospitals with correct type values and coordinates
INSERT INTO hospitals (name, type, category, address, city, state, phone, emergency_services, has_ambulance, rating, total_reviews, description, latitude, longitude, is_active) VALUES
('Lagos University Teaching Hospital', 'teaching', 'general', 'Idi-Araba, Surulere', 'Lagos', 'Lagos', '+234-1-7747000', true, true, 4.2, 1250, 'Premier teaching hospital in Lagos State', 6.5095, 3.3711, true),
('National Hospital Abuja', 'federal', 'general', 'Central Business District', 'Abuja', 'FCT', '+234-9-4613000', true, true, 4.5, 890, 'Federal government medical center in Abuja', 9.0579, 7.4951, true),
('Eko Hospital', 'private', 'general', '31 Mobolaji Bank Anthony Way, Ikeja', 'Lagos', 'Lagos', '+234-1-2806300', true, true, 4.7, 2100, 'Leading private hospital in Lagos', 6.6018, 3.3515, true),
('University College Hospital Ibadan', 'teaching', 'general', 'Queen Elizabeth Road', 'Ibadan', 'Oyo', '+234-2-2410088', true, true, 4.1, 980, 'Historic teaching hospital in Ibadan', 7.3986, 3.9022, true),
('Federal Medical Centre Abuja', 'federal', 'general', 'Jabi District', 'Abuja', 'FCT', '+234-9-2902001', true, true, 4.0, 750, 'Federal medical centre in Abuja', 9.0820, 7.4560, true),
('Reddington Hospital', 'private', 'general', '12 Idowu Martins Street, Victoria Island', 'Lagos', 'Lagos', '+234-1-4617000', true, true, 4.8, 1800, 'Premium private hospital on Victoria Island', 6.4281, 3.4219, true),
('Aminu Kano Teaching Hospital', 'teaching', 'general', 'Zaria Road', 'Kano', 'Kano', '+234-64-666000', true, true, 4.0, 620, 'Major teaching hospital in Kano', 12.0022, 8.5920, true),
('University of Nigeria Teaching Hospital', 'teaching', 'general', 'Ituku-Ozalla', 'Enugu', 'Enugu', '+234-42-253100', true, true, 4.1, 540, 'Teaching hospital in Enugu', 6.3350, 7.4653, true),
('St. Nicholas Hospital', 'private', 'general', '57 Campbell Street, Lagos Island', 'Lagos', 'Lagos', '+234-1-2660100', true, false, 4.5, 1100, 'Reputable private hospital on Lagos Island', 6.4541, 3.3947, true),
('Garki Hospital', 'state', 'general', 'Garki Area 1', 'Abuja', 'FCT', '+234-9-2340100', true, true, 3.9, 430, 'State government hospital in Abuja', 9.0333, 7.4833, true),
('Obafemi Awolowo University Teaching Hospital', 'teaching', 'general', 'Ile-Ife', 'Ile-Ife', 'Osun', '+234-36-230363', true, true, 4.2, 710, 'Teaching hospital in Ile-Ife', 7.5227, 4.5198, true),
('Cedarcrest Hospital', 'private', 'general', 'Cadastral Zone, Apo', 'Abuja', 'FCT', '+234-9-2913000', true, true, 4.6, 890, 'Modern private hospital in Abuja', 8.9806, 7.4531, true);

-- 3. Insert doctors with correct verification_status
INSERT INTO doctors (full_name, medical_license, specialization, years_experience, consultation_fee, verification_status, bio, average_rating, total_reviews, is_available, languages) VALUES
('Adebayo Johnson', 'MDCN-2024-001', 'General Practice', 8, 15000, 'verified', 'Experienced general practitioner with 8 years of clinical experience in Lagos.', 4.5, 120, true, '["English", "Yoruba"]'),
('Fatima Abdullahi', 'MDCN-2024-002', 'Cardiology', 12, 35000, 'verified', 'Consultant cardiologist specializing in heart disease management and prevention.', 4.8, 89, true, '["English", "Hausa"]'),
('Chinedu Okafor', 'MDCN-2024-003', 'Pediatrics', 6, 18000, 'verified', 'Dedicated pediatric specialist focused on child health and development.', 4.7, 156, true, '["English", "Igbo"]'),
('Aisha Mohammed', 'MDCN-2024-004', 'Gynecology', 9, 25000, 'verified', 'Women health specialist with expertise in obstetrics and gynecology.', 4.6, 203, true, '["English", "Hausa"]'),
('Olumide Adeyemi', 'MDCN-2024-005', 'Orthopedics', 13, 30000, 'verified', 'Orthopedic surgeon specializing in joint replacement and sports injuries.', 4.4, 95, true, '["English", "Yoruba"]'),
('Grace Okoro', 'MDCN-2024-006', 'Dermatology', 7, 20000, 'verified', 'Dermatologist with expertise in skin conditions and cosmetic dermatology.', 4.9, 178, true, '["English", "Igbo"]'),
('Emeka Nwosu', 'MDCN-2024-007', 'Neurology', 10, 40000, 'verified', 'Neurologist specializing in stroke management and neurological disorders.', 4.6, 67, true, '["English", "Igbo"]'),
('Halima Yusuf', 'MDCN-2024-008', 'General Practice', 5, 12000, 'verified', 'General practitioner providing comprehensive primary healthcare services.', 4.3, 88, true, '["English", "Hausa", "Fulani"]'),
('Tunde Bakare', 'MDCN-2024-009', 'Orthopedics', 15, 45000, 'verified', 'Senior orthopedic surgeon with extensive experience in complex bone surgeries.', 4.7, 112, false, '["English", "Yoruba"]'),
('Ngozi Eze', 'MDCN-2024-010', 'Gynecology', 11, 28000, 'verified', 'Obstetrician and gynecologist with special interest in high-risk pregnancies.', 4.8, 234, true, '["English", "Igbo"]'),
('Musa Ibrahim', 'MDCN-2024-011', 'Cardiology', 8, 32000, 'verified', 'Cardiologist with expertise in interventional cardiology and cardiac imaging.', 4.5, 76, true, '["English", "Hausa", "Arabic"]'),
('Chioma Obi', 'MDCN-2024-012', 'Dermatology', 4, 18000, 'verified', 'Young dermatologist specializing in acne, eczema, and skin cancer screening.', 4.4, 145, true, '["English", "Igbo"]');

-- 4. Verify data was inserted
SELECT 'Hospitals inserted: ' || COUNT(*)::text FROM hospitals;
SELECT 'Doctors inserted: ' || COUNT(*)::text FROM doctors WHERE verification_status = 'verified';