-- Migration: 20261014170000_folder_cycle_detection_and_safe_cascade.sql
-- Description: Enforce multi-node folder cycle prevention trigger and restrict direct cascading deletion of media folders containing items (ISSUE-44)

-- 1. Create multi-node cycle detection function for media_folders
CREATE OR REPLACE FUNCTION public.check_media_folders_cycle()
RETURNS TRIGGER AS $$
DECLARE
    cycle_detected BOOLEAN;
BEGIN
    -- If parent_id is null, it is a root folder, no cycle possible
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Self-parenting check
    IF NEW.id = NEW.parent_id THEN
        RAISE EXCEPTION 'A folder cannot be its own parent (id=%, parent_id=%)', NEW.id, NEW.parent_id
            USING ERRCODE = '23514'; -- check_violation
    END IF;

    -- Multi-node cycle check: verify that NEW.id is not an ancestor of NEW.parent_id
    WITH RECURSIVE ancestors AS (
        SELECT id, parent_id
        FROM public.media_folders
        WHERE id = NEW.parent_id AND user_id = NEW.user_id
        UNION ALL
        SELECT f.id, f.parent_id
        FROM public.media_folders f
        INNER JOIN ancestors a ON f.id = a.parent_id
        WHERE f.user_id = NEW.user_id
    )
    SELECT EXISTS (
        SELECT 1 FROM ancestors WHERE id = NEW.id
    ) INTO cycle_detected;

    IF cycle_detected THEN
        RAISE EXCEPTION 'Circular folder reference detected: moving folder % under parent % creates a loop', NEW.id, NEW.parent_id
            USING ERRCODE = '23514'; -- check_violation
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach BEFORE INSERT OR UPDATE trigger on media_folders
DROP TRIGGER IF EXISTS trg_media_folders_cycle_check ON public.media_folders;
CREATE TRIGGER trg_media_folders_cycle_check
    BEFORE INSERT OR UPDATE OF parent_id ON public.media_folders
    FOR EACH ROW
    WHEN (NEW.parent_id IS NOT NULL)
    EXECUTE FUNCTION public.check_media_folders_cycle();

-- 3. Replace ON DELETE CASCADE on media_items(folder_id) with ON DELETE RESTRICT
-- This guarantees database cascading deletes cannot silently orphan Cloudflare R2 media files
-- without going through application-layer pre-deletion purge hooks.
ALTER TABLE public.media_items
    DROP CONSTRAINT IF EXISTS fk_media_items_user_folder,
    ADD CONSTRAINT fk_media_items_user_folder
        FOREIGN KEY (user_id, folder_id)
        REFERENCES public.media_folders(user_id, id)
        ON DELETE RESTRICT;
