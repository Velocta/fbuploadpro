const ACCOUNT_BATCH_SIZE = 20;

export async function getFacebookAccountsForRefresh(supabase) {
  return supabase
    .from('facebook_accounts')
    .select('id, fb_user_id, fb_user_access_token')
    .eq('status', 'active')
    .order('updated_at', { ascending: true })
    .limit(ACCOUNT_BATCH_SIZE);
}

export async function updateFacebookAccountsBulk(supabase, updates) {
  if (!updates || updates.length === 0) {
    return { data: [], error: null };
  }

  return supabase.rpc('bulk_update_facebook_accounts', {
    p_updates: updates,
  });
}
