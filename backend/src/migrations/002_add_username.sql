-- Migration: Add username column to users and admin_users tables
-- Version: 1.0.1

-- =====================
-- USERS TABLE
-- =====================

-- 1. Add username column (nullable initially)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- 2. Generate username from email for existing users (email prefix before @)
UPDATE users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9]', '', 'g'))
WHERE username IS NULL;

-- 3. Handle duplicates by appending a random suffix
DO $$
DECLARE
    dup_record RECORD;
    new_username VARCHAR(50);
    counter INTEGER;
BEGIN
    FOR dup_record IN
        SELECT id, username
        FROM users
        WHERE username IN (
            SELECT username FROM users GROUP BY username HAVING COUNT(*) > 1
        )
        ORDER BY created_at DESC
    LOOP
        counter := 1;
        new_username := dup_record.username || counter::text;
        WHILE EXISTS (SELECT 1 FROM users WHERE username = new_username AND id != dup_record.id) LOOP
            counter := counter + 1;
            new_username := dup_record.username || counter::text;
        END LOOP;
        UPDATE users SET username = new_username WHERE id = dup_record.id;
    END LOOP;
END $$;

-- 4. Make username NOT NULL and UNIQUE
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 5. Create index for username lookup
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =====================
-- ADMIN_USERS TABLE
-- =====================

-- 1. Add username column (nullable initially)
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- 2. Generate username from email for existing admins
UPDATE admin_users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9]', '', 'g'))
WHERE username IS NULL;

-- 3. Handle duplicates
DO $$
DECLARE
    dup_record RECORD;
    new_username VARCHAR(50);
    counter INTEGER;
BEGIN
    FOR dup_record IN
        SELECT id, username
        FROM admin_users
        WHERE username IN (
            SELECT username FROM admin_users GROUP BY username HAVING COUNT(*) > 1
        )
        ORDER BY created_at DESC
    LOOP
        counter := 1;
        new_username := dup_record.username || counter::text;
        WHILE EXISTS (SELECT 1 FROM admin_users WHERE username = new_username AND id != dup_record.id) LOOP
            counter := counter + 1;
            new_username := dup_record.username || counter::text;
        END LOOP;
        UPDATE admin_users SET username = new_username WHERE id = dup_record.id;
    END LOOP;
END $$;

-- 4. Make username NOT NULL and UNIQUE
ALTER TABLE admin_users ALTER COLUMN username SET NOT NULL;
DO $$ BEGIN
    ALTER TABLE admin_users ADD CONSTRAINT admin_users_username_unique UNIQUE (username);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 5. Create index for username lookup
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
