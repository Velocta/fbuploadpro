export async function getNextPendingReel(supabase, pageId) {
  return supabase
    .from('reels')
    .select('id, reel_id')
    .eq('page_id', pageId)
    .eq('status', 'pending')
    .order('id', { ascending: true })
    .limit(1)
    .single();
}

export async function markReelFailed(supabase, reelId) {
  return supabase.from('reels').update({ status: 'failed' }).eq('id', reelId);
}

export async function markReelPostedWithToken(supabase, reelId) {
  return supabase.rpc('mark_reel_posted_with_token', { p_reel_id: reelId });
}
