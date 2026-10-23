-- =============================================================================
-- Spec 138 claim-rpc rig: deterministic fixture helpers.
--
-- Applied once per rig database by parity.ts / scale.ts (idempotent:
-- CREATE OR REPLACE). All ids are md5-derived so a case's graph is fully
-- deterministic. Cases run inside ONE transaction and seed timestamps as
-- now() - <interval> expressions, so the transaction timestamp the RPC
-- sees is the same now() the fixture ages are relative to — deferred
-- scheduled_time values can then be asserted EXACTLY against
-- now() + <expected offset> in the same transaction.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim138_test_id(tag TEXT, n INT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT md5('claim138-' || tag || '-' || n)::uuid;
$$;

-- Clear every table the cases touch and restore the spec 121 D5 seed
-- defaults + one tenant (user + workspace).
CREATE OR REPLACE FUNCTION public.claim138_reset()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE public.publish_logs, public.queue_items, public.destinations,
           public.social_accounts, public.workspaces, public.users CASCADE;
  TRUNCATE public.destination_claim_limits;
  INSERT INTO public.destination_claim_limits (platform, metric, cap, window_seconds) VALUES
    ('instagram', 'published', 100, 86400),
    ('instagram', 'calls',      25,  3600),
    ('threads',   'published', 250, 86400),
    ('x',         'published', 100,   900);
  INSERT INTO public.users (id, email, name)
  VALUES (public.claim138_test_id('user', 1), 'claim138.rig@gmail.com', 'Claim RPC Rig');
  INSERT INTO public.workspaces (id, owner_id, name, subdomain)
  VALUES (public.claim138_test_id('ws', 1), public.claim138_test_id('user', 1),
          'Claim RPC Rig WS', 'claim138-ws');
END;
$$;

-- Create one active social account + one destination for a platform.
-- n must be unique per (platform) within a case. Returns destination id.
CREATE OR REPLACE FUNCTION public.claim138_destination(
  p_platform TEXT,
  p_n INT,
  p_status TEXT DEFAULT 'active',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_next_allowed TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_account UUID := public.claim138_test_id('acct-' || p_platform, p_n);
  v_dest UUID := public.claim138_test_id('dest-' || p_platform, p_n);
BEGIN
  INSERT INTO public.social_accounts
    (id, workspace_id, platform, external_account_id, display_name,
     encrypted_access_token, status)
  VALUES
    (v_account, public.claim138_test_id('ws', 1), p_platform::public.platform,
     'ext-acct-' || p_platform || '-' || p_n, 'Rig ' || p_platform || ' account ' || p_n,
     'rig-access-token', 'active')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.destinations
    (id, workspace_id, account_id, platform, external_destination_id, name,
     encrypted_destination_token, status, metadata, next_allowed_publish_at)
  VALUES
    (v_dest, public.claim138_test_id('ws', 1), v_account, p_platform::public.platform,
     'ext-dest-' || p_platform || '-' || p_n, 'Rig ' || p_platform || ' destination ' || p_n,
     'rig-destination-token', p_status, p_metadata, p_next_allowed);
  RETURN v_dest;
END;
$$;

-- The deterministic id claim138_item will use for (destination, n).
CREATE OR REPLACE FUNCTION public.claim138_item_id(p_dest UUID, p_n INT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT md5('claim138-item-' || p_dest::text || '-' || p_n)::uuid;
$$;

-- Insert one queue item for a destination. n must be unique per
-- destination within a case. Non-text kinds get a media_url so the
-- claim RPC's media-presence rule passes. p_claimed / p_updated set the
-- in-flight timestamps (COALESCE(claimed_at, updated_at) is what the RPC
-- reads as an in-flight item's age).
CREATE OR REPLACE FUNCTION public.claim138_item(
  p_dest UUID,
  p_platform TEXT,
  p_n INT,
  p_kind TEXT DEFAULT 'text',
  p_status TEXT DEFAULT 'queued',
  p_scheduled TIMESTAMPTZ DEFAULT NULL,
  p_claimed TIMESTAMPTZ DEFAULT NULL,
  p_updated TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.destinations WHERE id = p_dest;
  INSERT INTO public.queue_items
    (id, workspace_id, destination_id, platform, kind, caption, media_url,
     scheduled_time, status, claimed_at, updated_at)
  VALUES
    (public.claim138_item_id(p_dest, p_n), v_ws, p_dest, p_platform::public.platform,
     p_kind, 'rig item',
     CASE WHEN p_kind = 'text' THEN NULL
          ELSE 'https://example.invalid/rig/' || p_n || '.bin' END,
     COALESCE(p_scheduled, now() - INTERVAL '1 minute'),
     p_status, p_claimed, COALESCE(p_updated, p_claimed, now()));
  RETURN public.claim138_item_id(p_dest, p_n);
END;
$$;

-- Insert p_count publish_logs rows for a destination, all at the same
-- created_at, attached to one anchor queue item (a real FK target; the
-- anchor itself is a 'published' item created by the caller).
CREATE OR REPLACE FUNCTION public.claim138_logs(
  p_dest UUID,
  p_platform TEXT,
  p_anchor_item UUID,
  p_result TEXT,
  p_count INT,
  p_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.publish_logs
    (id, queue_item_id, destination_id, platform, attempt_no, result, created_at)
  SELECT gen_random_uuid(), p_anchor_item, p_dest, p_platform::public.platform,
         1, p_result, p_at
  FROM generate_series(1, p_count);
END;
$$;
