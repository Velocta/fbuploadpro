-- Migration: 0006_users_phone_number.sql
-- Description: Add optional phone column to users table for contact and onboarding verification

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
