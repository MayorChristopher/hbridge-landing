-- Add sample medical records for testing
-- Replace 'your-user-id-here' with actual user ID from profiles table
-- Run this in Supabase SQL Editor

-- First, get a user ID (replace with actual user ID)
-- SELECT id FROM profiles LIMIT 1;

INSERT INTO medical_records (user_id, record_type, title, description, data, is_sensitive) VALUES
-- Replace 'your-user-id-here' with actual user ID
('your-user-id-here', 'lab_result', 'Blood Test Results - Complete Blood Count', 'Routine blood work showing normal values', '{"hemoglobin": "14.2 g/dL", "white_blood_cells": "7200/μL", "platelets": "250000/μL"}', false),
('your-user-id-here', 'lab_result', 'Cholesterol Panel', 'Lipid profile test results', '{"total_cholesterol": "180 mg/dL", "hdl": "55 mg/dL", "ldl": "110 mg/dL"}', false),
('your-user-id-here', 'prescription', 'Antibiotic Prescription', 'Prescribed for bacterial infection', '{"medication": "Amoxicillin", "dosage": "500mg", "frequency": "3 times daily", "duration": "7 days"}', true),
('your-user-id-here', 'vital_signs', 'Blood Pressure Reading', 'Regular BP check', '{"systolic": 120, "diastolic": 80, "heart_rate": 72, "temperature": 98.6}', false),
('your-user-id-here', 'vital_signs', 'Weight and Height Measurement', 'Routine vitals check', '{"weight": 70, "height": 175, "bmi": 22.9}', false),
('your-user-id-here', 'vital_signs', 'Temperature Check', 'Fever monitoring', '{"temperature": 99.2, "heart_rate": 85}', false),
('your-user-id-here', 'imaging', 'Chest X-Ray', 'Routine chest examination', '{"type": "X-Ray", "body_part": "Chest", "findings": "Normal lung fields"}', false);

-- To use this script:
-- 1. Go to Supabase SQL Editor
-- 2. Run: SELECT id FROM profiles WHERE email = 'your-email@example.com';
-- 3. Copy the user ID
-- 4. Replace all instances of 'your-user-id-here' with the actual user ID
-- 5. Run the INSERT statement