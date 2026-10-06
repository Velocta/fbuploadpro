import Parser from 'rss-parser';
import {
  finalizeItem,
  getDuePages,
  insertItem,
  isItemPostedInWindow,
  pausePage,
  updateItem,
  getSupabaseClient,
} from './db/client.js';
import { mapParserItem, pickItemWithImage } from './feed.js';
import { publishPhotoPost, postFirstComment } from './integrations/facebook.js';
import { renderViaWebapp } from './render-client.js';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
    ],
  },
});

const MAX_RETRIES = 3;

function log(event, fields = {}) {
  console.log(
    JSON.stringify({
      service: 'fb-rss-autoposter-slot-processor',
      event,
      ts: new Date().toISOString(),
      ...fields,
    })
  );
}

async function getTokenCost(supabase) {
  const { data } = await supabase
    .from('token_cost_rules')
    .select('token_cost')
    .eq('feature', 'rss_autoposter')
    .eq('platform', 'facebook')
    .eq('media_type', 'image')
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

async function fetchFeed(page) {
  const headers = {};
  if (page.feed_etag) headers['If-None-Match'] = page.feed_etag;
  if (page.feed_last_modified) headers['If-Modified-Since'] = page.feed_last_modified;

  const res = await fetch(page.rss_feed_url, { headers });
  if (res.status === 304) {
    return { items: null, etag: page.feed_etag, lastModified: page.feed_last_modified };
  }
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status}`);
  }
  const xml = await res.text();
  const feed = await parser.parseString(xml);
  const items = (feed.items || []).map((item) => mapParserItem(item));
  return {
    items,
    etag: res.headers.get('etag') || page.feed_etag,
    lastModified: res.headers.get('last-modified') || page.feed_last_modified,
  };
}

function buildRenderVariables(page, item, env) {
  const logoUrl = page.brand_logo_object_key && env.USER_MEDIA_PUBLIC_BASE_URL
    ? `${env.USER_MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '')}/${page.brand_logo_object_key}`
    : undefined;

  return {
    rss: {
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      link: item.link,
    },
    brand: {
      url: page.brand_site_url || undefined,
      logoUrl,
    },
    page: {
      name: page.fb_page_name || undefined,
    },
  };
}

async function processPage(env, supabase, page) {
  const isPosted = (guid) => isItemPostedInWindow(supabase, page.id, guid);

  let feedResult;
  try {
    feedResult = await fetchFeed(page);
  } catch (err) {
    await supabase
      .from('facebook_rss_autoposter_pages')
      .update({
        last_fetch_error: String(err?.message || err).slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', page.id);
    throw err;
  }

  if (feedResult.etag || feedResult.lastModified) {
    await supabase
      .from('facebook_rss_autoposter_pages')
      .update({
        feed_etag: feedResult.etag,
        feed_last_modified: feedResult.lastModified,
        last_fetch_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', page.id);
  }

  if (!feedResult.items?.length) {
    log('no_feed_change', { pageId: page.id });
    return;
  }

  const picked = await pickItemWithImage(feedResult.items, isPosted);
  if (!picked) {
    log('no_eligible_item', { pageId: page.id });
    return;
  }

  const { item } = picked;

  const row = await insertItem(supabase, {
    page_id: page.id,
    agency_id: page.agency_id,
    item_guid: item.guid,
    title: item.title,
    description: item.description,
    link: item.link,
    source_image_url: item.imageUrl,
    status: 'rendering',
    scheduled_at: new Date().toISOString(),
  });

  try {
    const definition = page.template_definition || { version: 1, canvas: { aspectRatio: page.canvas_aspect_ratio || '4:5' }, layers: [] };
    const variables = buildRenderVariables(page, item, env);

    const objectKey = await renderViaWebapp(env, {
      agencyId: page.agency_id,
      templateDefinition: definition,
      variables,
    });

    await updateItem(supabase, row.id, {
      status: 'pending_publish',
      rendered_object_key: objectKey,
      updated_at: new Date().toISOString(),
    });

    const publicBase = env.USER_MEDIA_PUBLIC_BASE_URL;
    if (!publicBase) throw new Error('USER_MEDIA_PUBLIC_BASE_URL required');
    const fileUrl = `${publicBase.replace(/\/$/, '')}/${objectKey}`;

    let graphPostId;
    try {
      graphPostId = await publishPhotoPost({
        pageId: page.fb_page_id,
        pageToken: page.fb_page_access_token,
        caption: item.description,
        fileUrl,
      });
    } catch (pubErr) {
      const msg = String(pubErr?.message || pubErr);
      if (msg.includes('OAuth') || msg.includes('access token') || msg.includes('190')) {
        await pausePage(supabase, page.id, msg);
      }
      throw pubErr;
    }

    if (page.first_comment?.trim()) {
      await postFirstComment({
        graphPostId,
        pageToken: page.fb_page_access_token,
        message: page.first_comment.trim(),
      });
    }

    const tokensCharged = await getTokenCost(supabase);
    await deductTokens(supabase, page.agency_id, tokensCharged);
    await finalizeItem(supabase, row.id, graphPostId, objectKey, tokensCharged);

    try {
      await env.USER_MEDIA.delete(objectKey);
    } catch {
      /* non-fatal */
    }

    log('published', { pageId: page.id, itemId: row.id, graphPostId });
  } catch (err) {
    const retry = (row.retry_count ?? 0) + 1;
    const status = retry >= MAX_RETRIES ? 'failed' : 'skipped';
    await updateItem(supabase, row.id, {
      status,
      retry_count: retry,
      error_message: String(err?.message || err).slice(0, 500),
      updated_at: new Date().toISOString(),
    });
    log('item_failed', { pageId: page.id, itemId: row.id, message: String(err?.message || err) });
  }
}

export default {
  async fetch() {
    return new Response('RSS Auto Poster Slot Processor Active', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    const supabase = getSupabaseClient(env);
    const { data: pages, error } = await getDuePages(supabase);
    if (error) {
      log('due_pages_error', { message: error.message });
      return;
    }

    for (const page of pages || []) {
      const work = processPage(env, supabase, page).catch((err) =>
        log('page_error', { pageId: page.id, message: String(err?.message || err) })
      );
      ctx.waitUntil(work);
    }
  },
};
