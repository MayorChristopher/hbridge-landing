-- Add title prefix column to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS title VARCHAR(20) DEFAULT 'Dr.';

-- Update existing doctors to have default title
UPDATE doctors SET title = 'Dr.' WHERE title IS NULL OR title = '';
