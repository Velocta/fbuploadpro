# Data Model: Spec 034 — Dedicated Facebook Pages Management Section

## 1. PostgreSQL Schema Evolution (`facebook_pages`)

Migration file: `supabase/migrations/20261011180000_facebook_pages_followers_tracking.sql`

```sql
-- Rename followers_count to current_followers on facebook_pages
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facebook_pages'
      AND column_name = 'followers_count'
  ) THEN
    ALTER TABLE public.facebook_pages RENAME COLUMN followers_count TO current_followers;
  END IF;
END $$;

-- Add starting_followers baseline column
ALTER TABLE public.facebook_pages
  ADD COLUMN IF NOT EXISTS starting_followers INT NOT NULL DEFAULT 0 CHECK (starting_followers >= 0);

-- Backfill starting_followers from current_followers for any pre-existing rows where starting_followers = 0
UPDATE public.facebook_pages
SET starting_followers = current_followers
WHERE starting_followers = 0 AND current_followers > 0;
```

## 2. Domain Contracts (`@fbuploadpro/contracts`)

### `FacebookPageSchema`
- `id`: `UUID`
- `userId`: `UUID`
- `facebookAccountId`: `UUID`
- `fbPageId`: `string`
- `pageName`: `string`
- `profilePictureUrl`: `string | null`
- `category`: `string | null`
- `tasks`: `string[]`
- `startingFollowers`: `number` (non-negative int, default `0`)
- `currentFollowers`: `number` (non-negative int, default `0`)
- `followersCount`: `number` (optional backwards-compatible alias defaulting to `currentFollowers`)
- `encryptedAccessToken`: `string`
- `status`: `FacebookPageStatus` (`'active' | 'paused' | 'fb_rate_limited' | 'page_checkpoint' | 'invalid_token' | 'disconnected'`)
- `createdAt`: `Date`
- `updatedAt`: `Date`

### `FacebookPageViewSchema`
- `id`: `UUID`
- `facebookAccountId`: `UUID`
- `accountDisplayName`: `string`
- `fbPageId`: `string`
- `pageName`: `string`
- `profilePictureUrl`: `string | null`
- `category`: `string | null`
- `startingFollowers`: `number` (non-negative int)
- `currentFollowers`: `number` (non-negative int)
- `followersGained`: `number` (signed int: `currentFollowers - startingFollowers`, can be negative, zero, or positive)
- `followersCount`: `number` (backwards-compatible alias equal to `currentFollowers`)
- `status`: `FacebookPageStatus`
- `tasks`: `string[]`
- `createdAt`: `Date`
- `updatedAt`: `Date`
