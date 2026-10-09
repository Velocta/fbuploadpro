-- Migration: Add 'pending_verification' status to users table
-- Description: Supports initial staging in public users table during Supabase Auth registration before OTP confirmation

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'pending_verification'));
