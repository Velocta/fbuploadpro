-- Migration: 20261014120000_prevent_workspace_owner_transfer.sql
-- Description: Prevent cross-tenant workspace ownership hijacking by enforcing immutable owner_id on public.workspaces

CREATE OR REPLACE FUNCTION public.prevent_workspace_owner_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION 'Workspace owner_id is immutable and cannot be transferred or overwritten (Principle III & 27)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_workspace_owner_transfer ON public.workspaces;
CREATE TRIGGER trg_prevent_workspace_owner_transfer
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.prevent_workspace_owner_transfer();
