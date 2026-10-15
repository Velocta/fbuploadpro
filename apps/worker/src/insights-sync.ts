import { decryptToken, type PageInsightsDailySnapshot } from '@fbuploadpro/contracts';

export interface InsightsSyncDbClient {
  query?<T = unknown>(text: string, params?: unknown[]): Promise<T[] | { rows?: T[] }>;
  from?(table: string): {
    upsert(data: unknown, options?: { onConflict?: string }): Promise<{ error?: unknown }>;
    update(data: unknown): {
      eq(col1: string, val1: unknown): {
        eq(col2: string, val2: unknown): Promise<{ error?: unknown }>;
      };
    };
  };
  upsertPageInsightsSnapshot?(snapshot: PageInsightsDailySnapshot): Promise<void>;
}

export interface SyncDailyPageInsightsOptions {
  db: InsightsSyncDbClient;
  masterKey: string;
  fbApiUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  targetDate?: string | undefined;
  concurrency?: number | undefined;
  batchSize?: number | undefined;
}

export interface InsightsSyncResult {
  totalEligible: number;
  synced: number;
  failed: number;
  errors: Array<{ pageId: string; error: string }>;
}

interface FacebookPageRow {
  id: string;
  user_id: string;
  fb_page_id: string;
  page_name: string;
  encrypted_access_token: string;
  status: string;
}

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function fetchPageOverview(
  fbPageId: string,
  token: string,
  fbApiUrl: string,
  fetchFn: typeof fetch
): Promise<{ fanCount: number; followersCount: number }> {
  const overviewRes = await fetchFn(
    `${fbApiUrl}/${fbPageId}?fields=fan_count,followers_count`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!overviewRes.ok) {
    const errJson = await overviewRes.json().catch(() => ({}));
    const msg =
      (errJson as { error?: { message?: string } })?.error?.message ||
      `Overview API responded with ${overviewRes.status}`;
    throw new Error(msg);
  }

  const overviewData = (await overviewRes.json()) as {
    fan_count?: number;
    followers_count?: number;
  };
  return {
    fanCount: overviewData.fan_count || 0,
    followersCount: overviewData.followers_count || 0,
  };
}

async function fetchDailyMetrics(
  fbPageId: string,
  token: string,
  fbApiUrl: string,
  fetchFn: typeof fetch,
  targetDate?: string
) {
  const metricsList = [
    'page_daily_follows_unique',
    'page_daily_unfollows_unique',
    'page_views_total',
    'page_video_views',
    'page_video_complete_views_30s',
    'page_video_view_time',
  ].join(',');

  const queryParams = new URLSearchParams({
    metric: metricsList,
    period: 'day',
  });

  if (targetDate) {
    const sinceDate = new Date(`${targetDate}T00:00:00Z`);
    const untilDate = new Date(`${targetDate}T23:59:59Z`);
    queryParams.set('since', String(Math.floor(sinceDate.getTime() / 1000)));
    queryParams.set('until', String(Math.floor(untilDate.getTime() / 1000)));
  }

  const metricsRes = await fetchFn(
    `${fbApiUrl}/${fbPageId}/insights?${queryParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!metricsRes.ok) {
    const errJson = await metricsRes.json().catch(() => ({}));
    const msg =
      (errJson as { error?: { message?: string } })?.error?.message ||
      `Daily metrics API responded with ${metricsRes.status}`;
    throw new Error(msg);
  }

  const metricsJson = (await metricsRes.json()) as {
    data?: Array<{
      name: string;
      values?: Array<{ value: number; end_time?: string }>;
    }>;
  };

  const metricMap = new Map<string, number>();
  for (const item of metricsJson.data || []) {
    const val = item.values?.[0]?.value ?? 0;
    metricMap.set(item.name, Number(val) || 0);
  }

  const dailyFollows = metricMap.get('page_daily_follows_unique') || 0;
  const dailyUnfollows = metricMap.get('page_daily_unfollows_unique') || 0;
  const mediaViews = metricMap.get('page_views_total') || 0;
  const videoViews = metricMap.get('page_video_views') || 0;
  const videoCompleteViews30s = metricMap.get('page_video_complete_views_30s') || 0;
  const rawWatchTime = metricMap.get('page_video_view_time') || 0;
  const videoViewTimeSeconds = Math.round(rawWatchTime / 1000);

  return {
    dailyFollows,
    dailyUnfollows,
    mediaViews,
    videoViews,
    videoCompleteViews30s,
    videoViewTimeSeconds,
  };
}

async function fetchReactionsAndDemographics(
  fbPageId: string,
  token: string,
  fbApiUrl: string,
  fetchFn: typeof fetch,
  targetDate?: string
) {
  const queryParams = new URLSearchParams({
    metric:
      'page_actions_post_reactions_like_total,page_actions_post_reactions_love_total,page_fans_country,page_fans_city',
    period: 'day',
  });

  if (targetDate) {
    const sinceDate = new Date(`${targetDate}T00:00:00Z`);
    const untilDate = new Date(`${targetDate}T23:59:59Z`);
    queryParams.set('since', String(Math.floor(sinceDate.getTime() / 1000)));
    queryParams.set('until', String(Math.floor(untilDate.getTime() / 1000)));
  }

  const reactionsAndDemoRes = await fetchFn(
    `${fbApiUrl}/${fbPageId}/insights?${queryParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!reactionsAndDemoRes.ok) {
    const errJson = await reactionsAndDemoRes.json().catch(() => ({}));
    const msg =
      (errJson as { error?: { message?: string } })?.error?.message ||
      `Reactions and demographics API responded with ${reactionsAndDemoRes.status}`;
    throw new Error(msg);
  }

  const reactionsSummary: Record<string, number> = {};
  const demographicsSummary: Record<string, unknown> = {};

  const rdJson = (await reactionsAndDemoRes.json()) as {
    data?: Array<{
      name: string;
      values?: Array<{ value: unknown }>;
    }>;
  };

  for (const item of rdJson.data || []) {
    if (item.name.startsWith('page_actions_post_reactions_')) {
      const reactionName = item.name.replace('page_actions_post_reactions_', '').replace('_total', '');
      const count = Number(item.values?.[0]?.value) || 0;
      reactionsSummary[reactionName] = count;
    } else if (item.name === 'page_fans_country') {
      demographicsSummary.countries = item.values?.[0]?.value || {};
    } else if (item.name === 'page_fans_city') {
      demographicsSummary.cities = item.values?.[0]?.value || {};
    }
  }

  return { reactionsSummary, demographicsSummary };
}

async function savePageSnapshot(
  page: FacebookPageRow,
  snapshot: PageInsightsDailySnapshot,
  followersCount: number,
  db: InsightsSyncDbClient
): Promise<void> {
  if (typeof db.from === 'function') {
    const { error: upsertErr } = await db.from('page_insights_daily_snapshots').upsert({
      user_id: snapshot.userId,
      fb_page_id: snapshot.fbPageId,
      snapshot_date: snapshot.snapshotDate,
      fan_count: snapshot.fanCount,
      followers_count: snapshot.followersCount,
      daily_follows: snapshot.dailyFollows ?? 0,
      daily_unfollows: snapshot.dailyUnfollows ?? 0,
      media_views: snapshot.mediaViews ?? 0,
      video_views: snapshot.videoViews ?? 0,
      video_complete_views_30s: snapshot.videoCompleteViews30s ?? 0,
      video_view_time_seconds: snapshot.videoViewTimeSeconds ?? 0,
      reactions_summary: snapshot.reactionsSummary ?? {},
      demographics_summary: snapshot.demographicsSummary ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,fb_page_id,snapshot_date' });
    if (upsertErr) throw upsertErr;

    const pageUpdate: Record<string, unknown> = {
      current_followers: followersCount,
    };
    if (page.status !== 'fb_rate_limited') {
      pageUpdate.updated_at = new Date().toISOString();
    }
    await db.from('facebook_pages').update(pageUpdate).eq('user_id', page.user_id).eq('fb_page_id', page.fb_page_id);
  } else if (typeof db.upsertPageInsightsSnapshot === 'function') {
    await db.upsertPageInsightsSnapshot(snapshot);
    if (typeof db.query === 'function') {
      await db.query(
        `UPDATE facebook_pages
         SET current_followers = $1,
             updated_at = CASE WHEN status = 'fb_rate_limited' THEN updated_at ELSE now() END
         WHERE id = $2`,
        [followersCount, page.id]
      );
    }
  } else if (typeof db.query === 'function') {
    await db.query(
      `INSERT INTO page_insights_daily_snapshots (
         user_id, fb_page_id, snapshot_date, fan_count, followers_count,
         daily_follows, daily_unfollows, media_views, video_views,
         video_complete_views_30s, video_view_time_seconds,
         reactions_summary, demographics_summary, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (user_id, fb_page_id, snapshot_date)
       DO UPDATE SET
         fan_count = EXCLUDED.fan_count,
         followers_count = EXCLUDED.followers_count,
         daily_follows = EXCLUDED.daily_follows,
         daily_unfollows = EXCLUDED.daily_unfollows,
         media_views = EXCLUDED.media_views,
         video_views = EXCLUDED.video_views,
         video_complete_views_30s = EXCLUDED.video_complete_views_30s,
         video_view_time_seconds = EXCLUDED.video_view_time_seconds,
         reactions_summary = EXCLUDED.reactions_summary,
         demographics_summary = EXCLUDED.demographics_summary,
         updated_at = now();`,
      [
        snapshot.userId,
        snapshot.fbPageId,
        snapshot.snapshotDate,
        snapshot.fanCount,
        snapshot.followersCount,
        snapshot.dailyFollows,
        snapshot.dailyUnfollows,
        snapshot.mediaViews,
        snapshot.videoViews,
        snapshot.videoCompleteViews30s,
        snapshot.videoViewTimeSeconds,
        JSON.stringify(snapshot.reactionsSummary || {}),
        JSON.stringify(snapshot.demographicsSummary || {}),
      ]
    );

    await db.query(
      `UPDATE facebook_pages
       SET current_followers = $1,
           updated_at = CASE WHEN status = 'fb_rate_limited' THEN updated_at ELSE now() END
       WHERE user_id = $2 AND fb_page_id = $3`,
      [followersCount, page.user_id, page.fb_page_id]
    );
  }
}

async function syncSinglePage(
  page: FacebookPageRow,
  db: InsightsSyncDbClient,
  masterKey: string,
  fbApiUrl: string,
  fetchFn: typeof fetch,
  targetDate: string
): Promise<void> {
  // 1. Decrypt access token server-side
  let token: string | null;
  try {
    token = await decryptToken(page.encrypted_access_token, masterKey, { allowEmpty: true });
  } catch (decryptErr) {
    throw new Error(
      `Decryption failed for page ${page.fb_page_id}: ${
        decryptErr instanceof Error ? decryptErr.message : String(decryptErr)
      }`
    );
  }

  if (!token) {
    throw new Error(
      `Access token for page ${page.fb_page_id} is missing or page is soft-deleted`
    );
  }

  // 2. Fetch Overview, Metrics, and Reactions in parallel
  const [overview, metrics, reactions] = await Promise.all([
    fetchPageOverview(page.fb_page_id, token, fbApiUrl, fetchFn),
    fetchDailyMetrics(page.fb_page_id, token, fbApiUrl, fetchFn, targetDate),
    fetchReactionsAndDemographics(page.fb_page_id, token, fbApiUrl, fetchFn, targetDate),
  ]);

  // 3. Upsert Daily Snapshot into Database
  const snapshot: PageInsightsDailySnapshot = {
    userId: page.user_id,
    fbPageId: page.fb_page_id,
    snapshotDate: targetDate,
    fanCount: overview.fanCount,
    followersCount: overview.followersCount,
    dailyFollows: metrics.dailyFollows,
    dailyUnfollows: metrics.dailyUnfollows,
    mediaViews: metrics.mediaViews,
    videoViews: metrics.videoViews,
    videoCompleteViews30s: metrics.videoCompleteViews30s,
    videoViewTimeSeconds: metrics.videoViewTimeSeconds,
    reactionsSummary: reactions.reactionsSummary,
    demographicsSummary: reactions.demographicsSummary,
  };

  await savePageSnapshot(page, snapshot, overview.followersCount, db);
}

export async function syncDailyPageInsights(
  options: SyncDailyPageInsightsOptions
): Promise<InsightsSyncResult> {
  const { db, masterKey, fbApiUrl = 'https://graph.facebook.com/v26.0', concurrency = 5 } = options;
  const fetchFn = options.fetchImpl || globalThis.fetch;
  const poolLimit = Math.max(1, concurrency);

  // Default target date to yesterday (YYYY-MM-DD)
  const targetDate =
    options.targetDate ||
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

  const result: InsightsSyncResult = {
    totalEligible: 0,
    synced: 0,
    failed: 0,
    errors: [],
  };

  const fetchBatchSize = Math.max(1, options.batchSize ?? 200);

  // 1. Fetch active pages or pages whose 3-day rate limit cooldown has elapsed (excluding empty tokens from soft-deleted pages)
  let eligiblePages: FacebookPageRow[] = [];
  if (typeof db.from === 'function') {
    const cooldownThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let queryBuilder = db
        .from('facebook_pages')
        .select('id, user_id, fb_page_id, page_name, encrypted_access_token, status, updated_at');

      if (typeof queryBuilder.neq === 'function') {
        queryBuilder = queryBuilder.neq('encrypted_access_token', '');
      }

      if (typeof queryBuilder.range === 'function') {
        queryBuilder = queryBuilder.range(offset, offset + fetchBatchSize - 1);
      }

      const { data } = await queryBuilder.or(
        `status.eq.active,and(status.eq.fb_rate_limited,updated_at.lte."${cooldownThreshold}")`
      );

      const rows = ((data || []) as FacebookPageRow[]).filter(
        (p) => Boolean(p.encrypted_access_token && p.encrypted_access_token.trim() !== '')
      );

      eligiblePages.push(...rows);

      if (!data || data.length < fetchBatchSize || typeof queryBuilder.range !== 'function') {
        hasMore = false;
      } else {
        offset += fetchBatchSize;
      }
    }
  } else if (typeof db.query === 'function') {
    const rawPages = await db.query(
      `SELECT id, user_id, fb_page_id, page_name, encrypted_access_token, status
       FROM facebook_pages
       WHERE encrypted_access_token <> ''
         AND (status = 'active'
           OR (status = 'fb_rate_limited' AND updated_at <= now() - INTERVAL '3 days'))`
    );
    eligiblePages = extractRows<FacebookPageRow>(rawPages).filter(
      (p) => Boolean(p.encrypted_access_token && p.encrypted_access_token.trim() !== '')
    );
  }
  result.totalEligible = eligiblePages.length;

  // Process eligible pages in bounded concurrency chunks
  for (let i = 0; i < eligiblePages.length; i += poolLimit) {
    const chunk = eligiblePages.slice(i, i + poolLimit);
    await Promise.all(
      chunk.map(async (page) => {
        try {
          await syncSinglePage(page, db, masterKey, fbApiUrl, fetchFn, targetDate);
          result.synced += 1;
        } catch (err) {
          result.failed += 1;
          const errorMsg = err instanceof Error ? err.message : String(err);
          result.errors.push({
            pageId: page.fb_page_id,
            error: errorMsg,
          });
          console.warn(`[InsightsSync] Failed for page ${page.fb_page_id}: ${errorMsg}`);
        }
      })
    );
  }

  return result;
}
