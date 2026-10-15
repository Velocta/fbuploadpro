-- Migration: 20261020000000_drop_byoc_webhook_verify_token.sql
-- Description: Drop unused webhook_verify_token column from workspace_byoc_credentials (Spec 048)

ALTER TABLE public.workspace_byoc_credentials
DROP COLUMN IF EXISTS webhook_verify_token;
