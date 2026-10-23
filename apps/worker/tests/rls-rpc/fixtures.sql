-- =============================================================================
-- Spec 117 rls-rpc rig: deterministic fixtures.
--
-- Applied once per rig database by check.ts (idempotent: CREATE OR
-- REPLACE). Fixed UUIDs keep every case readable. rls117_reset() clears
-- the tables the assertions touch and re-seeds the two-tenant graph:
--
--   user A (…1111) owns workspace A (…aaaa), a Facebook account + page
--     carrying dummy encrypted-token strings, and legacy queue items.
--   user B (…2222) owns workspace B (…bbbb).
--   A manipulated BYOC row: user_id = A but workspace_id = B's workspace
--     (seeded as superuser, bypassing RLS — the row an attacker would
--     plant; the hardened policy must make it invisible to A).
--   media_download_jobs rows for A and B (user_id FKs auth.users, so
--     auth.users is seeded with the same ids).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rls117_reset()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE public.workspace_byoc_credentials, public.media_download_jobs,
           public.legacy_publish_logs, public.legacy_queue_items,
           public.facebook_pages, public.facebook_accounts,
           public.publish_logs, public.queue_items, public.destinations,
           public.social_accounts,
           public.workspaces, public.users CASCADE;
  TRUNCATE auth.users CASCADE;

  INSERT INTO auth.users (id, email) VALUES
    ('11111111-1111-1111-1111-111111111111', 'rls117.a@gmail.com'),
    ('22222222-2222-2222-2222-222222222222', 'rls117.b@gmail.com');

  INSERT INTO public.users (id, email, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'rls117.a@gmail.com', 'Rig User A'),
    ('22222222-2222-2222-2222-222222222222', 'rls117.b@gmail.com', 'Rig User B');

  INSERT INTO public.workspaces (id, owner_id, name, subdomain) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Rig WS A', 'rls117-ws-a'),
    ('acacacac-acac-acac-acac-acacacacacac', '11111111-1111-1111-1111-111111111111', 'Rig WS A2', 'rls117-ws-a2'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Rig WS B', 'rls117-ws-b'),
    ('abababab-abab-abab-abab-abababababab', '22222222-2222-2222-2222-222222222222', 'Rig WS C (B, empty)', 'rls117-ws-c');

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

  INSERT INTO public.media_download_jobs (user_id, source_url) VALUES
    ('11111111-1111-1111-1111-111111111111', 'https://example.com/a.mp4'),
    ('22222222-2222-2222-2222-222222222222', 'https://example.com/b.mp4');

  -- Minimal unified-schema graph (workspace A) so the unified settle
  -- overload can be exercised end-to-end as service_role.
  INSERT INTO public.social_accounts (id, workspace_id, platform, external_account_id, display_name, encrypted_access_token, status) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'facebook', 'ext-acct-a', 'Rig Unified Account A', 'dummy-encrypted-access-token', 'active');

  INSERT INTO public.destinations (id, workspace_id, account_id, platform, external_destination_id, name, encrypted_destination_token, status) VALUES
    ('f0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'f0000000-0000-0000-0000-000000000001', 'facebook', 'ext-dest-a', 'Rig Unified Dest A',
     'dummy-encrypted-destination-token', 'active');

  INSERT INTO public.queue_items (id, workspace_id, destination_id, platform, kind, caption, scheduled_time, status) VALUES
    ('f0000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'f0000000-0000-0000-0000-000000000002', 'facebook', 'text', 'rig unified caption',
     now() - INTERVAL '1 hour', 'queued');
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
