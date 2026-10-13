-- Migration: 20261013120000_remove_users_subdomain_and_auto_workspaces.sql
-- Description: Drop subdomain column from users table; workspaces table is now the sole source of truth for subdomains.

-- 1. Ensure any remaining users have a default workspace created if missing
INSERT INTO workspaces (id, owner_id, name, subdomain, created_at, updated_at)
SELECT 
    gen_random_uuid(), 
    u.id, 
    COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)), 
    COALESCE(u.subdomain, split_part(u.email, '@', 1)), 
    u.created_at, 
    u.updated_at
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.owner_id = u.id
)
ON CONFLICT (subdomain) DO NOTHING;

-- 2. Drop the index on users.subdomain
DROP INDEX IF EXISTS idx_users_subdomain;

-- 3. Drop subdomain column from users table
ALTER TABLE users DROP COLUMN IF EXISTS subdomain;

-- 4. Index workspaces by owner_id and created_at to quickly resolve primary workspace
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_created ON workspaces(owner_id, created_at ASC);
