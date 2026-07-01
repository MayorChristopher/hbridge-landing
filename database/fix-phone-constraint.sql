-- Drop the phone unique constraint that blocks profile upserts
-- Multiple family members may share a phone number, and it causes silent
-- signup failures where user_type never gets saved
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- Also make phone fully nullable with no uniqueness
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;
