-- ============================================================================
-- Spec 119 Phase 7 — drop the legacy Facebook publishing schema.
--
-- This is the final expand→backfill→cutover→drop step (spec 119 §4.3).
-- The unified schema (20261022120000) has been the worker's only world
-- since 2026-10-22; this migration removes the pre-unification tables
-- and RPC overloads now that every web consumer is repointed in the
-- same PR (prep: specs/119-multi-platform-publishing-engine/
-- phase-7-prep.md §5 gates G1–G10, §7.3 census, §7.6 execution log).
--
-- ONE-WAY: Shahzeb ruled G8 = NO SNAPSHOT (2026-10-24). There is no
-- archive copy and no compat view — the drop proceeds on the strength
-- of the zero-grep receipts (G10) + the zero-delta census (G7) + the
-- reconciliation assertion in STEP 1, which fails this migration
-- loudly if production has drifted from the census in any class.
--
-- Deploy accounting (spec 128 T13): one-tick cron pause at deploy;
-- the unified queue_items 'publishing'-row count/state is stated in
-- the PR (census context: queue_items total = 1, the single legacy
-- item's unified copy, status failed/terminal).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 — Reconciliation assertion (prep §2.3 / §7.3).
--
-- The G7 census (executed 2026-10-24 on production via the Supabase
-- dashboard SQL editor, recorded verbatim in phase-7-prep.md §7.3)
-- proved ZERO DELTA in every class:
--   C1 parity exact (accounts 1=1, pages 6=6, slots 3=3, queue items
--      1=1, publish logs 4=4, byoc credentials 1)
--   C2 the 1 legacy queue item is status=failed (terminal)
--   C3 0 legacy-only items · C4 0 non-terminal legacy-only items
--   C5 diverged_items 0 · C6 legacy_only_pages 0, diverged_pages 0
--   C7 legacy_only_accounts 0, diverged_accounts 0
--   C8 legacy_only_slots 0, diverged_slots 0
--   C9 legacy_only_logs 0 (stop condition CLEAR)
--   C10 0 inbound FKs from surviving tables (stop condition CLEAR)
-- So the pre-agreed catch-up copies resolve to a no-op. The checks
-- are kept here as assertions (same query shapes as the census pack)
-- so the migration re-proves zero delta at apply time and FAILS
-- rather than dropping data if anything has moved since the census.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.legacy_queue_items lqi
    LEFT JOIN public.queue_items qi ON qi.id = lqi.id
    WHERE qi.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: legacy-only queue items exist (census C3) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.legacy_queue_items lqi
    JOIN public.queue_items qi ON qi.id = lqi.id
    WHERE lqi.updated_at > qi.updated_at
       OR lqi.caption IS DISTINCT FROM qi.caption
       OR lqi.scheduled_time IS DISTINCT FROM qi.scheduled_time
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: diverged queue items exist (census C5) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.facebook_pages fp
    LEFT JOIN public.destinations d ON d.id = fp.id
    WHERE d.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: legacy-only pages exist (census C6) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.facebook_pages fp
    JOIN public.destinations d ON d.id = fp.id
    WHERE fp.timezone IS DISTINCT FROM d.timezone
       OR fp.page_name IS DISTINCT FROM d.name
       OR (CASE fp.status::text WHEN 'active' THEN 'active' WHEN 'fb_rate_limited' THEN 'rate_limited'
              WHEN 'paused' THEN 'disconnected' WHEN 'disconnected' THEN 'disconnected' ELSE 'error' END)
          IS DISTINCT FROM d.status::text
       OR fp.updated_at > d.updated_at
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: diverged pages exist (census C6) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.facebook_accounts fa
    LEFT JOIN public.social_accounts sa ON sa.id = fa.id
    WHERE sa.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: legacy-only accounts exist (census C7) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.facebook_accounts fa
    JOIN public.social_accounts sa ON sa.id = fa.id
    WHERE (CASE fa.status::text WHEN 'active' THEN 'active' WHEN 'expired' THEN 'expired'
              WHEN 'disconnected' THEN 'revoked' ELSE 'error' END) IS DISTINCT FROM sa.status::text
       OR fa.updated_at > sa.updated_at
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: diverged accounts exist (census C7) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.page_queue_slots s
    LEFT JOIN public.posting_slots ps ON ps.id = s.id
    WHERE ps.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: legacy-only slots exist (census C8) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.page_queue_slots s
    JOIN public.posting_slots ps ON ps.id = s.id
    WHERE s.slot_time IS DISTINCT FROM ps.time_of_day
       OR s.allowed_formats IS DISTINCT FROM ps.kind
       OR s.is_active IS DISTINCT FROM ps.is_active
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: diverged slots exist (census C8) — drop aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.legacy_publish_logs lpl
    LEFT JOIN public.publish_logs pl ON pl.id = lpl.id
    WHERE pl.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 7 reconciliation: legacy-only publish logs exist (census C9) — drop aborted';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 2 — Legacy RPC overloads, EXACT SIGNATURES (name-only drops
-- are ambiguous while the unified overloads share the names; the
-- unified overloads MUST survive — the post-drop rig assertions prove
-- they do). Every signature re-verified against the migration chain
-- at build time:
--   get_page_queue_status_counts(UUID, UUID)         20261016000000
--   claim_due_queue_items(INT, INT)                  20261018000000 (final legacy form)
--   settle_queue_item_outcome(16 args, INT codes)    20261022120000 §2
--   recover_stuck_publishing_items(INT)              20261018000000 (final legacy form)
--   fail_stuck_download_jobs(INT)                    20261019000000
--   claim_queue_slot_insert(9 args)                  20261024120000 (A15, #761)
-- claim_queue_slot_insert also RETURNS SETOF the legacy queue table,
-- so it must go before the tables in STEP 3.
-- media_download_jobs is NOT dropped (prep B6 — the downloader
-- surface is kept); only its legacy RPC overload goes.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_page_queue_status_counts(UUID, UUID);
DROP FUNCTION IF EXISTS public.claim_due_queue_items(INT, INT);
DROP FUNCTION IF EXISTS public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, INT, INT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT);
DROP FUNCTION IF EXISTS public.recover_stuck_publishing_items(INT);
DROP FUNCTION IF EXISTS public.fail_stuck_download_jobs(INT);
DROP FUNCTION IF EXISTS public.claim_queue_slot_insert(UUID, UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT);

-- ---------------------------------------------------------------------------
-- STEP 3 — Tables, children first (policies/triggers/indexes die with
-- their tables). FK reality (census C10 + prep §3.1.4): every FK into
-- this set originates inside the set —
--   legacy_publish_logs -> legacy_queue_items
--   legacy_queue_items  -> facebook_pages, page_queue_slots
--   page_queue_slots    -> facebook_pages
--   facebook_pages      -> facebook_accounts
-- so this order needs no CASCADE; an unexpected inbound FK from a
-- surviving table fails the drop loudly instead of cascading.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.legacy_publish_logs;
DROP TABLE IF EXISTS public.legacy_queue_items;
DROP TABLE IF EXISTS public.page_queue_slots;
DROP TABLE IF EXISTS public.facebook_pages;
DROP TABLE IF EXISTS public.facebook_accounts;
DROP TABLE IF EXISTS public.workspace_byoc_credentials;
