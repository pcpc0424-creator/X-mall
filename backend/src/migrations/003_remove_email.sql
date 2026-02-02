-- Migration: Remove email column from users and admin_users tables
-- Version: 1.0.2
-- Date: 2026-02-01
-- Description: 이메일 로그인에서 아이디(username) 로그인으로 전환 완료 후 email 컬럼 정리

-- =====================
-- USERS TABLE
-- =====================
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP COLUMN IF EXISTS email;

-- =====================
-- ADMIN_USERS TABLE
-- =====================
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_email_key;
ALTER TABLE admin_users DROP COLUMN IF EXISTS email;
