-- Spec 139 A15 queue-slot-collision rig fixtures.
-- One user, one workspace, one Facebook page (UTC), three daily queue
-- slots (09:00 / 13:00 / 18:00 UTC) and one media item — the smallest
-- graph the queue-mode enqueue path touches. Deterministic ids so the
-- check runner can hard-code them.
--
-- qslot_reset() wipes every table the enqueue path reads or writes so
-- each check section starts from the same seeded state; it is called
-- by check.ts before every section (not on load).

CREATE OR REPLACE FUNCTION public.qslot_reset() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE public.legacy_queue_items, public.page_queue_slots,
           public.facebook_pages, public.facebook_accounts,
           public.media_items, public.workspaces, public.users CASCADE;
  TRUNCATE auth.users CASCADE;

  INSERT INTO auth.users (id, email) VALUES
    ('11111111-1111-1111-1111-111111111111', 'qslot.a@gmail.com');

  INSERT INTO public.users (id, email, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'qslot.a@gmail.com', 'Rig User A');

  INSERT INTO public.workspaces (id, owner_id, name, subdomain) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '11111111-1111-1111-1111-111111111111', 'Rig WS A', 'qslot-ws-a');

  INSERT INTO public.facebook_accounts (id, user_id, workspace_id, fb_account_id, display_name, encrypted_access_token, status) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc',
     '11111111-1111-1111-1111-111111111111',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'fb-acct-a', 'Rig FB Account A', 'dummy-encrypted-access-token', 'active');

  INSERT INTO public.facebook_pages (id, user_id, workspace_id, facebook_account_id, fb_page_id, page_name, encrypted_access_token, status, timezone) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd',
     '11111111-1111-1111-1111-111111111111',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-cccccccccccc', 'fb-page-a', 'Rig Page A',
     'dummy-encrypted-page-token', 'active', 'UTC');

  INSERT INTO public.page_queue_slots (id, user_id, fb_page_id, slot_time, is_active, allowed_formats) VALUES
    ('51000000-0000-4000-a000-000000000001',
     '11111111-1111-1111-1111-111111111111',
     'dddddddd-dddd-dddd-dddd-dddddddddddd', '09:00:00', true, '{}'),
    ('51000000-0000-4000-a000-000000000002',
     '11111111-1111-1111-1111-111111111111',
     'dddddddd-dddd-dddd-dddd-dddddddddddd', '13:00:00', true, '{}'),
    ('51000000-0000-4000-a000-000000000003',
     '11111111-1111-1111-1111-111111111111',
     'dddddddd-dddd-dddd-dddd-dddddddddddd', '18:00:00', true, '{}');

  INSERT INTO public.media_items (id, user_id, name, media_type, url, file_size, mime_type, storage_key, aspect_ratio) VALUES
    ('e0000000-0000-4000-a000-000000000001',
     '11111111-1111-1111-1111-111111111111',
     'rig-photo.jpg', 'image', 'https://cdn.example.com/rig-photo.jpg',
     1024, 'image/jpeg', 'rig/rig-photo.jpg', '1:1');
END;
$$;

SELECT public.qslot_reset();
