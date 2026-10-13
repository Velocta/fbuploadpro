-- Migration: 20261014130000_add_password_updated_at_to_users.sql
-- Description: Add password_updated_at column to users table to invalidate active sessions across all devices upon password reset (Principle IV, 12, 29).

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_password_updated_at ON public.users(password_updated_at);
