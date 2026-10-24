-- =============================================================================
-- Spec 117 rls-rpc rig: LEGACY fixtures — vulnerable mode ONLY.
--
-- check.ts applies this file only when RLS_RPC_MODE=vulnerable, whose
-- database is built with migrations stopped at
-- 20261022140000_claim_rpc_grouped_usage.sql — i.e. BEFORE the spec 117
-- hardening AND before the Phase 7 drop (20261024130000). On that
-- database the pre-unification tables still exist, and the rig's
-- original sections (a)/(c)/(d) assert the holes are open there.
--
-- On the hardened (all-migrations) database these tables are dropped;
-- applying this file would fail, which is precisely the post-drop
-- state the hardened mode asserts in its absence section.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rls117_reset_legacy()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE public.workspace_byoc_credentials,
           public.legacy_publish_logs, public.legacy_queue_items,
           public.facebook_pages, public.facebook_accounts CASCADE;

  INSERT INTO public.facebook_accounts (id, user_id, workspace_id, fb_account_id, display_name, encrypted_access_token, status) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'fb-acct-a', 'Rig FB Account A', 'dummy-encrypted-access-token', 'active');

  INSERT INTO public.facebook_pages (id, user_id, workspace_id, facebook_account_id, fb_page_id, page_name, encrypted_access_token, status) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-cccccccccccc', 'fb-page-a', 'Rig Page A',
     'dummy-encrypted-page-token', 'active');

  -- Legitimate BYOC row: A's credentials in A's own workspace.
  INSERT INTO public.workspace_byoc_credentials (id, workspace_id, user_id, fb_app_id, encrypted_fb_app_secret) VALUES
    ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '11111111-1111-1111-1111-111111111111', 'app-a', 'dummy-encrypted-secret-a');

  -- Manipulated BYOC row: claims user_id = A but sits in B's workspace.
  INSERT INTO public.workspace_byoc_credentials (id, workspace_id, user_id, fb_app_id, encrypted_fb_app_secret) VALUES
    ('e2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     '11111111-1111-1111-1111-111111111111', 'app-planted', 'dummy-encrypted-secret-planted');
END;
$$;

-- Insert n due legacy queue items (text posts, so no media row is
-- needed) for user A's page, all scheduled in the past.
CREATE OR REPLACE FUNCTION public.rls117_seed_legacy_items(p_n INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.legacy_queue_items (id, user_id, fb_page_id, media_id, scheduled_time, caption, post_format, status)
  SELECT md5('rls117-item-' || g)::uuid,
         '11111111-1111-1111-1111-111111111111',
         'dddddddd-dddd-dddd-dddd-dddddddddddd',
         NULL,
         now() - INTERVAL '1 hour',
         'rig caption ' || g,
         'text',
         'queued'
  FROM generate_series(1, p_n) AS g;
END;
$$;
