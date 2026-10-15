# Data Model: 046 Downloader and Media Library Audit Remediation

## 1. Modified Tables & Entities

### `public.media_items`
- `width`: INT NULL (pixel width)
- `height`: INT NULL (pixel height)
- `aspect_ratio`: VARCHAR(20) (`9:16`, `16:9`, `1:1`, `4:5`, `unknown`)
- `thumbnail_url`: TEXT NULL
- `thumbnail_key`: VARCHAR NULL

### `public.media_download_jobs`
- `status`: VARCHAR(20) (`queued`, `downloading`, `processing`, `completed`, `failed`, `cancelled`)
- `metadata`: JSONB containing:
  - `media_ids`: UUID[] (supporting multi-item carousels)
  - `caption`: TEXT NULL
  - `thumbnail_url`: TEXT NULL
  - `error_message`: TEXT NULL

---

## 2. Stored Procedures & RPCs

### `public.fail_stuck_download_jobs`
```sql
CREATE OR REPLACE FUNCTION public.fail_stuck_download_jobs(
  p_timeout_minutes INT DEFAULT 15
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count INT;
BEGIN
  WITH failed_jobs AS (
    UPDATE public.media_download_jobs
    SET status = 'failed',
        error_message = 'Download timed out after 15 minutes of inactivity.',
        updated_at = now()
    WHERE status IN ('queued', 'downloading', 'processing')
      AND updated_at <= now() - make_interval(mins => GREATEST(1, p_timeout_minutes))
    RETURNING id
  )
  SELECT count(*)::INT INTO v_failed_count FROM failed_jobs;

  RETURN COALESCE(v_failed_count, 0);
END;
$$;
```
