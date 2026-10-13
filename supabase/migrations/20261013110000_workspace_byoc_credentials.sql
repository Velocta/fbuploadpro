-- Migration: 20261013110000_workspace_byoc_credentials.sql
-- Description: Multi-workspace ownership and workspace-scoped BYOC Facebook App credentials

-- 1. Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    subdomain VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_subdomain ON workspaces(subdomain);

-- 2. Backfill existing users into workspaces table
INSERT INTO workspaces (id, owner_id, name, subdomain, created_at, updated_at)
SELECT gen_random_uuid(), id, COALESCE(NULLIF(name, ''), subdomain), subdomain, created_at, updated_at
FROM users
ON CONFLICT (subdomain) DO NOTHING;

-- 3. Create workspace_byoc_credentials table
CREATE TABLE IF NOT EXISTS workspace_byoc_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fb_app_id VARCHAR(100) NOT NULL,
    encrypted_fb_app_secret TEXT NOT NULL,
    webhook_verify_token VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'valid', 'invalid')),
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_byoc UNIQUE (workspace_id),
    CONSTRAINT uq_workspace_byoc_user UNIQUE (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_byoc_workspace_id ON workspace_byoc_credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_byoc_user_id ON workspace_byoc_credentials(user_id);
