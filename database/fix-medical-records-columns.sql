-- Add missing data column to medical_records table
-- Run this in Supabase SQL Editor

ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT false;