-- Drop unused delete-page RPC after switching back to direct page deletes.
-- Date: 2026-04-22

revoke execute on function public.delete_page_with_fast_cleanup(uuid) from authenticated;
revoke execute on function public.delete_page_with_fast_cleanup(uuid) from service_role;

drop function if exists public.delete_page_with_fast_cleanup(uuid);
