-- Privacy Settings Table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS privacy_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    profile_visible BOOLEAN DEFAULT true,
    share_health_data BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    data_analytics BOOLEAN DEFAULT true,
    location_sharing BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can insert own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can update own privacy settings" ON privacy_settings;

CREATE POLICY "Users can view own privacy settings"
ON privacy_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own privacy settings"
ON privacy_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own privacy settings"
ON privacy_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id ON privacy_settings(user_id);
