const PAGE_BATCH_SIZE = 40;

export async function getPagesForFollowerRefresh(supabase) {
  return supabase
    .from('pages')
    .select('id, fb_page_id, fb_page_access_token')
    .eq('status', 'active')
    .eq('is_followers_updated', false)
    .order('updated_at', { ascending: true })
    .limit(PAGE_BATCH_SIZE);
}

export async function updatePagesFollowersGainedBulk(supabase, updates) {
  if (!updates || updates.length === 0) {
    return { data: [], error: null };
  }

  return supabase.rpc('bulk_update_page_metrics', {
    p_updates: updates,
  });
}

export async function resetFollowersRefreshCycle(supabase) {
  return supabase
    .from('pages')
    .update({ is_followers_updated: false })
    .eq('status', 'active')
    .eq('is_followers_updated', true);
}

export async function getInappPagesForFollowerRefresh(supabase) {
  return supabase
    .from('facebook_inapp_schedule_pages')
    .select('id, fb_page_id, fb_page_access_token')
    .eq('status', 'active')
    .eq('is_followers_updated', false)
    .order('created_at', { ascending: true })
    .limit(PAGE_BATCH_SIZE);
}

export async function updateInappPagesFollowersGainedBulk(supabase, updates) {
  if (!updates || updates.length === 0) {
    return { data: [], error: null };
  }

  return supabase.rpc('bulk_update_inapp_page_metrics', {
    p_updates: updates,
  });
}

export async function resetInappFollowersRefreshCycle(supabase) {
  return supabase
    .from('facebook_inapp_schedule_pages')
    .update({ is_followers_updated: false })
    .eq('status', 'active')
    .eq('is_followers_updated', true);
}
