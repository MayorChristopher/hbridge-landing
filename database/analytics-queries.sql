-- Analytics Dashboard Queries

-- 1. Daily Active Users
SELECT 
    DATE(timestamp) as date,
    COUNT(DISTINCT user_id) as daily_active_users
FROM analytics_events 
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- 2. Most Popular Features
SELECT 
    event_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users
FROM analytics_events 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY event_name
ORDER BY usage_count DESC
LIMIT 10;

-- 3. User Journey Analysis
SELECT 
    user_id,
    event_name,
    properties->>'screen_name' as screen_name,
    timestamp
FROM analytics_events 
WHERE user_id IS NOT NULL
    AND timestamp >= NOW() - INTERVAL '1 day'
ORDER BY user_id, timestamp;

-- 4. Error Rate by Type
SELECT 
    error_type,
    COUNT(*) as error_count,
    COUNT(DISTINCT user_id) as affected_users,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM error_reports), 2) as percentage
FROM error_reports 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY error_type
ORDER BY error_count DESC;

-- 5. Screen Performance
SELECT 
    properties->>'screen_name' as screen_name,
    COUNT(*) as views,
    AVG((properties->>'duration_ms')::numeric) as avg_duration_ms,
    COUNT(DISTINCT user_id) as unique_viewers
FROM analytics_events 
WHERE event_name = 'screen_duration'
    AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY properties->>'screen_name'
ORDER BY views DESC;

-- 6. User Retention (7-day)
WITH first_seen AS (
    SELECT 
        user_id,
        MIN(DATE(timestamp)) as first_date
    FROM analytics_events
    GROUP BY user_id
),
retention AS (
    SELECT 
        fs.first_date,
        COUNT(DISTINCT fs.user_id) as cohort_size,
        COUNT(DISTINCT CASE 
            WHEN ae.timestamp >= fs.first_date + INTERVAL '7 days' 
            AND ae.timestamp < fs.first_date + INTERVAL '8 days'
            THEN fs.user_id 
        END) as retained_users
    FROM first_seen fs
    LEFT JOIN analytics_events ae ON fs.user_id = ae.user_id
    WHERE fs.first_date >= NOW() - INTERVAL '30 days'
    GROUP BY fs.first_date
)
SELECT 
    first_date,
    cohort_size,
    retained_users,
    ROUND(retained_users * 100.0 / cohort_size, 2) as retention_rate
FROM retention
ORDER BY first_date DESC;

-- 7. Feature Adoption Rate
SELECT 
    event_name,
    COUNT(DISTINCT user_id) as users_used,
    (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE timestamp >= NOW() - INTERVAL '7 days') as total_users,
    ROUND(COUNT(DISTINCT user_id) * 100.0 / (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE timestamp >= NOW() - INTERVAL '7 days'), 2) as adoption_rate
FROM analytics_events 
WHERE timestamp >= NOW() - INTERVAL '7 days'
    AND event_name IN ('ai_chat', 'search', 'doctor_booking', 'medical_records')
GROUP BY event_name
ORDER BY adoption_rate DESC;