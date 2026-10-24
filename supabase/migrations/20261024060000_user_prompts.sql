-- Migration: spec 144 Prompt Library — personal prompts
-- Description: Per-user prompt library (OD-144-1: per-USER, global across
-- workspaces, following the Media Library precedent in
-- 20261014180000_global_user_media_library.sql). Curated prompts are
-- in-code data in packages/contracts (OD-144-2) and need no table.

CREATE TABLE IF NOT EXISTS public.user_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN (
        'hooks', 'captions', 'video-ideas', 'repurposing', 'engagement', 'hashtags'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_prompts_user_created
    ON public.user_prompts (user_id, created_at DESC);

ALTER TABLE public.user_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_prompts_user_access" ON public.user_prompts;
CREATE POLICY "user_prompts_user_access" ON public.user_prompts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
