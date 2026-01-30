-- Migration: Add referrer/genealogy system
-- Description: Add referrer_id column to users table for tracking referrals and genealogy

-- Add referrer_id column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster genealogy queries
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);

-- Create function to check that referrer is an active dealer
CREATE OR REPLACE FUNCTION check_referrer_is_dealer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referrer_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM users
            WHERE id = NEW.referrer_id
            AND grade = 'dealer'
            AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Referrer must be an active dealer';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_check_referrer_is_dealer ON users;

-- Create trigger to validate referrer on insert/update
CREATE TRIGGER trigger_check_referrer_is_dealer
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION check_referrer_is_dealer();
