-- Migration: Add denormalized reel counts to pages table
-- Created: 2026-02-07

-- 1. Add count columns to pages table
ALTER TABLE pages 
ADD COLUMN IF NOT EXISTS pending_reels_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS posted_reels_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_reels_count INT DEFAULT 0;

-- 2. Initialize counts with existing data
UPDATE pages p
SET 
  pending_reels_count = (SELECT count(*) FROM reels r WHERE r.page_id = p.id AND r.status = 'pending'),
  posted_reels_count = (SELECT count(*) FROM reels r WHERE r.page_id = p.id AND r.status = 'posted'),
  failed_reels_count = (SELECT count(*) FROM reels r WHERE r.page_id = p.id AND r.status = 'failed');

-- 3. Create function to update counts on reels changes
CREATE OR REPLACE FUNCTION update_page_reel_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'pending' THEN 
            UPDATE pages SET pending_reels_count = pending_reels_count + 1 WHERE id = NEW.page_id; 
        ELSIF NEW.status = 'posted' THEN 
            UPDATE pages SET posted_reels_count = posted_reels_count + 1 WHERE id = NEW.page_id; 
        ELSIF NEW.status = 'failed' THEN 
            UPDATE pages SET failed_reels_count = failed_reels_count + 1 WHERE id = NEW.page_id; 
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle status change
        IF OLD.status <> NEW.status THEN
            -- Decrement old status
            IF OLD.status = 'pending' THEN UPDATE pages SET pending_reels_count = pending_reels_count - 1 WHERE id = OLD.page_id; END IF;
            IF OLD.status = 'posted' THEN UPDATE pages SET posted_reels_count = posted_reels_count - 1 WHERE id = OLD.page_id; END IF;
            IF OLD.status = 'failed' THEN UPDATE pages SET failed_reels_count = failed_reels_count - 1 WHERE id = OLD.page_id; END IF;
            -- Increment new status
            IF NEW.status = 'pending' THEN UPDATE pages SET pending_reels_count = pending_reels_count + 1 WHERE id = NEW.page_id; END IF;
            IF NEW.status = 'posted' THEN UPDATE pages SET posted_reels_count = posted_reels_count + 1 WHERE id = NEW.page_id; END IF;
            IF NEW.status = 'failed' THEN UPDATE pages SET failed_reels_count = failed_reels_count + 1 WHERE id = NEW.page_id; END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'pending' THEN UPDATE pages SET pending_reels_count = pending_reels_count - 1 WHERE id = OLD.page_id; END IF;
        IF OLD.status = 'posted' THEN UPDATE pages SET posted_reels_count = posted_reels_count - 1 WHERE id = OLD.page_id; END IF;
        IF OLD.status = 'failed' THEN UPDATE pages SET failed_reels_count = failed_reels_count - 1 WHERE id = OLD.page_id; END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger
DROP TRIGGER IF EXISTS tr_update_page_reel_counts ON reels;
CREATE TRIGGER tr_update_page_reel_counts
AFTER INSERT OR UPDATE OR DELETE ON reels
FOR EACH ROW EXECUTE FUNCTION update_page_reel_counts();
