-- Migration: 20261014153000_repair_orphan_users_without_workspaces.sql
-- Description: Repair migration to detect and backfill default workspaces for users with 0 workspaces due to historical subdomain collisions.

DO $$
DECLARE
    orphan_user RECORD;
    base_subdomain TEXT;
    candidate_subdomain TEXT;
    counter INT;
    suffix TEXT;
BEGIN
    FOR orphan_user IN
        SELECT u.id, u.email, u.name, u.created_at, u.updated_at
        FROM "public"."users" u
        WHERE NOT EXISTS (
            SELECT 1 FROM "public"."workspaces" w WHERE w.owner_id = u.id
        )
        ORDER BY u.created_at ASC
    LOOP
        -- Sanitize email prefix to conform to valid subdomain format (lowercase alphanumeric & hyphens)
        base_subdomain := lower(regexp_replace(split_part(orphan_user.email, '@', 1), '[^a-z0-9]', '', 'g'));
        
        -- Fallback if prefix is empty or too short
        IF length(base_subdomain) < 3 THEN
            base_subdomain := 'user';
        END IF;

        -- Trim base subdomain to ensure room for counter/random suffix (max 50 chars)
        IF length(base_subdomain) > 30 THEN
            base_subdomain := substr(base_subdomain, 1, 30);
        END IF;

        candidate_subdomain := base_subdomain;
        counter := 1;

        -- Loop until a non-colliding subdomain is found
        WHILE EXISTS (SELECT 1 FROM "public"."workspaces" WHERE lower(subdomain) = lower(candidate_subdomain)) LOOP
            suffix := '-' || substr(md5(gen_random_uuid()::text), 1, 6);
            candidate_subdomain := substr(base_subdomain, 1, 40) || suffix;
            counter := counter + 1;
            
            -- Failsafe break after 50 attempts using UUID
            IF counter > 50 THEN
                candidate_subdomain := 'ws-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
                EXIT;
            END IF;
        END LOOP;

        -- Insert the repaired workspace for the orphaned user
        INSERT INTO "public"."workspaces" (
            id,
            owner_id,
            name,
            subdomain,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            orphan_user.id,
            COALESCE(NULLIF(orphan_user.name, ''), split_part(orphan_user.email, '@', 1)),
            candidate_subdomain,
            orphan_user.created_at,
            orphan_user.updated_at
        )
        ON CONFLICT (subdomain) DO NOTHING;
    END LOOP;
END $$;
