-- Migration: Ensure users table status constraint strictly enforces 'active' and 'suspended'
-- Description: Aligns with native Supabase Auth email_confirmed_at lifecycle and removes redundant pending_verification state

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
UPDATE users SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'suspended');
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended'));
