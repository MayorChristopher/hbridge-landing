-- Fix schema to match app expectations
-- Run this in Supabase SQL Editor AFTER running working-schema.sql

-- Add missing columns to users table that the app expects
ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_license VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255);

-- Update RLS policies to allow upsert operations
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Add upsert policy
CREATE POLICY "Users can upsert their own data" ON users FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);

-- Ensure the users table has proper constraints
ALTER TABLE users ALTER COLUMN id SET DEFAULT auth.uid();