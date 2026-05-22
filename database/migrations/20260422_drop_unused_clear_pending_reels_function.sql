-- Drop unused source-update cleanup RPC and revoke public execute grants.
-- Date: 2026-04-22

revoke execute on function public.clear_pending_reels_for_page(uuid) from authenticated;
revoke execute on function public.clear_pending_reels_for_page(uuid) from service_role;

drop function if exists public.clear_pending_reels_for_page(uuid, integer);
drop function if exists public.clear_pending_reels_for_page(uuid);
