import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getDuePages(supabase) {
  return supabase.rpc('get_facebook_rss_autoposter_pages_due_posting');
}

export async function isItemPostedInWindow(supabase, pageId, itemGuid) {
  const { data, error } = await supabase.rpc('is_rss_item_posted_in_window', {
    p_page_id: pageId,
    p_item_guid: itemGuid,
    p_days: 7,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function insertItem(supabase, row) {
  const { data, error } = await supabase
    .from('facebook_rss_autoposter_items')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateItem(supabase, id, patch) {
  const { error } = await supabase.from('facebook_rss_autoposter_items').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function finalizeItem(supabase, itemId, graphPostId, objectKey, tokensCharged) {
  const { error } = await supabase.rpc('finalize_facebook_rss_autoposter_item', {
    p_item_id: itemId,
    p_graph_post_id: graphPostId,
    p_rendered_object_key: objectKey,
    p_tokens_charged: tokensCharged,
  });
  if (error) throw new Error(error.message);
}

export async function pausePage(supabase, pageId, message) {
  await supabase
    .from('facebook_rss_autoposter_pages')
    .update({
      status: 'paused',
      last_fetch_error: String(message || '').slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pageId);
}
