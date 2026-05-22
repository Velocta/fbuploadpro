import { claimDuePosts, getSupabaseClient } from './db/client.js';
import { postFirstComment, publishFeedPost } from './integrations/facebook.js';

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;

function log(event, fields = {}) {
  console.log(JSON.stringify({ service: 'fb-inapp-schedule-processor', event, ts: new Date().toISOString(), ...fields }));
}

async function getTokenCost(supabase, mediaType) {
  const { data } = await supabase
    .from('token_cost_rules')
    .select('token_cost')
    .eq('feature', 'inapp_schedule')
    .eq('platform', 'facebook')
    .eq('media_type', '*')
    .is('source_platform', null)
    .maybeSingle();
  return data?.token_cost ?? 1;
}

async function deductTokens(supabase, agencyId, amount) {
  if (amount <= 0) return;
  const { data: user } = await supabase.from('users').select('tokens_balance').eq('id', agencyId).single();
  const next = Math.max(0, (user?.tokens_balance ?? 0) - amount);
  await supabase.from('users').update({ tokens_balance: next }).eq('id', agencyId);
}

async function markFailed(supabase, post, message) {
  const retry = (post.retry_count ?? 0) + 1;
  const status = retry >= MAX_RETRIES ? 'failed' : 'pending';
  const scheduled_at =
    status === 'pending'
      ? new Date(Date.now() + RETRY_BACKOFF_MS).toISOString()
      : post.scheduled_at;

  await supabase
    .from('facebook_inapp_schedule_posts')
    .update({
      status,
      retry_count: retry,
      error_message: String(message || '').slice(0, 500),
      scheduled_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', post.id);
}

async function processPost(env, supabase, post) {
  let fileUrl;
  if (post.media_object_key) {
    const publicBase = env.USER_MEDIA_PUBLIC_BASE_URL;
    if (!publicBase) {
      throw new Error('USER_MEDIA_PUBLIC_BASE_URL required for Facebook file_url publish');
    }
    fileUrl = `${publicBase.replace(/\/$/, '')}/${post.media_object_key}`;
  }

  const graphPostId = await publishFeedPost({
    pageId: post.fb_page_id,
    pageToken: post.fb_page_access_token,
    mediaType: post.media_type,
    caption: post.caption,
    fileUrl,
  });

  if (post.first_comment?.trim()) {
    await postFirstComment({
      graphPostId,
      pageToken: post.fb_page_access_token,
      message: post.first_comment.trim(),
    });
  }

  const tokensCharged = await getTokenCost(supabase, post.media_type);
  await deductTokens(supabase, post.agency_id, tokensCharged);

  if (post.media_object_key) {
    await env.USER_MEDIA.delete(post.media_object_key);
  }

  await supabase
    .from('facebook_inapp_schedule_posts')
    .update({
      status: 'published',
      graph_post_id: graphPostId,
      tokens_charged: tokensCharged,
      published_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', post.id);
}

export default {
  async fetch() {
    return new Response('InApp Schedule Processor Active', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    const supabase = getSupabaseClient(env);
    const { data: posts, error } = await claimDuePosts(supabase, 10);
    if (error) {
      log('claim_error', { message: error.message });
      return;
    }

    for (const post of posts || []) {
      const work = processPost(env, supabase, post).catch((err) =>
        markFailed(supabase, post, err?.message || err)
      );
      ctx.waitUntil(work);
    }
  },
};
