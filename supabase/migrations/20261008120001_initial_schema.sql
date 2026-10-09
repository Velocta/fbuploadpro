-- Migration: 0001_initial_schema.sql
-- Description: Users root tenant and operator schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    subdomain VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'seller', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS facebook_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fb_account_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fb_accounts_user_account UNIQUE (user_id, fb_account_id),
    CONSTRAINT uq_fb_accounts_user_id UNIQUE (user_id, id)
);

CREATE TABLE IF NOT EXISTS facebook_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    facebook_account_id UUID NOT NULL,
    fb_page_id VARCHAR(100) NOT NULL,
    page_name VARCHAR(255) NOT NULL,
    followers_count INT NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fb_rate_limited', 'invalid_token', 'disconnected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_fb_pages_user_account FOREIGN KEY (user_id, facebook_account_id)
        REFERENCES facebook_accounts(user_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_fb_pages_user_page UNIQUE (user_id, fb_page_id)
);

CREATE INDEX IF NOT EXISTS idx_fb_accounts_user_id ON facebook_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_fb_pages_user_id ON facebook_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_fb_pages_account_id ON facebook_pages(facebook_account_id);

