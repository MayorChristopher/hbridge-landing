-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_type TEXT,
    screen_name TEXT,
    properties JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Analytics Properties Table
CREATE TABLE IF NOT EXISTS user_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    properties JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error Reports Table
CREATE TABLE IF NOT EXISTS error_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    error_type TEXT NOT NULL CHECK (error_type IN ('crash', 'error', 'warning')),
    message TEXT NOT NULL,
    stack TEXT,
    user_id UUID REFERENCES auth.users(id),
    user_type TEXT,
    screen_name TEXT,
    app_version TEXT,
    device_info JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Usage Statistics Table
CREATE TABLE IF NOT EXISTS app_usage_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    session_start TIMESTAMPTZ,
    session_end TIMESTAMPTZ,
    screen_views INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    app_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_error_type ON error_reports(error_type);
CREATE INDEX IF NOT EXISTS idx_error_reports_timestamp ON error_reports(timestamp);

-- Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_usage_stats ENABLE ROW LEVEL SECURITY;

-- Policies for analytics_events
CREATE POLICY "Users can insert their own analytics events" ON analytics_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics events" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id);

-- Policies for user_analytics
CREATE POLICY "Users can manage their own analytics properties" ON user_analytics
    FOR ALL USING (auth.uid() = user_id);

-- Policies for error_reports
CREATE POLICY "Users can insert their own error reports" ON error_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for app_usage_stats
CREATE POLICY "Users can manage their own usage stats" ON app_usage_stats
    FOR ALL USING (auth.uid() = user_id);

-- Admin policies (for developers to view all data)
CREATE POLICY "Admins can view all analytics" ON analytics_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type = 'admin'
        )
    );

CREATE POLICY "Admins can view all errors" ON error_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type = 'admin'
        )
    );