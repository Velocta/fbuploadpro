import { decryptToken } from '@fbuploadpro/contracts';
import type { PageInsightsDailySnapshot } from '@fbuploadpro/database';

export interface InsightsSyncDbClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[] | { rows?: T[] }>;
  upsertPageInsightsSnapshot?(snapshot: PageInsightsDailySnapshot): Promise<void>;
}

export interface SyncDailyPageInsightsOptions {
  db: InsightsSyncDbClient;
  masterKey: string;
  fbApiUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  targetDate?: string | undefined;
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

export async function syncDailyPageInsights(
  options: SyncDailyPageInsightsOptions
): Promise<InsightsSyncResult> {
  const { db, masterKey, fbApiUrl = 'https://graph.facebook.com/v26.0' } = options;
  const fetchFn = options.fetchImpl || globalThis.fetch;

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

  // 1. Query active connected Facebook Pages
  const rawPages = await db.query(
    `SELECT id, user_id, fb_page_id, page_name, encrypted_access_token, status
     FROM facebook_pages
     WHERE status = 'active'`
  );
  const eligiblePages = extractRows<FacebookPageRow>(rawPages);
  result.totalEligible = eligiblePages.length;

  for (const page of eligiblePages) {
    try {
      // 2. Decrypt access token server-side
      let token: string;
      try {
        token = await decryptToken(page.encrypted_access_token, masterKey);
      } catch (decryptErr) {
        throw new Error(
          `Decryption failed for page ${page.fb_page_id}: ${
            decryptErr instanceof Error ? decryptErr.message : String(decryptErr)
          }`
        );
      }

      // 3. Fetch Overview (Fan count, Followers count)
      const overviewRes = await fetchFn(
        `${fbApiUrl}/${page.fb_page_id}?fields=fan_count,followers_count&access_token=${encodeURIComponent(
          token
        )}`
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
      const fanCount = overviewData.fan_count || 0;
      const followersCount = overviewData.followers_count || 0;

      // 4. Fetch Daily Time-Series Metrics
      const metricsList = [
        'page_daily_follows_unique',
        'page_daily_unfollows_unique',
        'page_views_total',
        'page_video_views',
        'page_video_complete_views_30s',
        'page_video_view_time',
      ].join(',');

      const metricsRes = await fetchFn(
        `${fbApiUrl}/${page.fb_page_id}/insights?metric=${metricsList}&period=day&access_token=${encodeURIComponent(
          token
        )}`
      );

      let dailyFollows = 0;
      let dailyUnfollows = 0;
      let mediaViews = 0;
      let videoViews = 0;
      let videoCompleteViews30s = 0;
      let videoViewTimeSeconds = 0;

      if (metricsRes.ok) {
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

        dailyFollows = metricMap.get('page_daily_follows_unique') || 0;
        dailyUnfollows = metricMap.get('page_daily_unfollows_unique') || 0;
        mediaViews = metricMap.get('page_views_total') || 0;
        videoViews = metricMap.get('page_video_views') || 0;
        videoCompleteViews30s = metricMap.get('page_video_complete_views_30s') || 0;
        // Facebook returns page_video_view_time in milliseconds or seconds
        const rawWatchTime = metricMap.get('page_video_view_time') || 0;
        videoViewTimeSeconds = rawWatchTime > 10000 ? Math.round(rawWatchTime / 1000) : rawWatchTime;
      }

      // 5. Fetch Reactions and Demographics
      const reactionsAndDemoRes = await fetchFn(
        `${fbApiUrl}/${page.fb_page_id}/insights?metric=page_actions_post_reactions_like_total,page_actions_post_reactions_love_total,page_fans_country,page_fans_city&period=day&access_token=${encodeURIComponent(
          token
        )}`
      );

      const reactionsSummary: Record<string, number> = {};
      const demographicsSummary: Record<string, unknown> = {};

      if (reactionsAndDemoRes.ok) {
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
      }

      // 6. Upsert Daily Snapshot into PostgreSQL
      const snapshot: PageInsightsDailySnapshot = {
        userId: page.user_id,
        fbPageId: page.fb_page_id,
        snapshotDate: targetDate,
        fanCount,
        followersCount,
        dailyFollows,
        dailyUnfollows,
        mediaViews,
        videoViews,
        videoCompleteViews30s,
        videoViewTimeSeconds,
        reactionsSummary,
        demographicsSummary,
      };

      if (typeof db.upsertPageInsightsSnapshot === 'function') {
        await db.upsertPageInsightsSnapshot(snapshot);
      } else {
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
      }

      // 7. Update followers_count in facebook_pages table
      await db.query(
        `UPDATE facebook_pages
         SET followers_count = $1, updated_at = now()
         WHERE id = $2`,
        [followersCount, page.id]
      );

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
  }

  return result;
}
