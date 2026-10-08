import {
  evaluateGraphApiError,
  type PageInsightsHealthStatus,
  type PageInsightsOverview,
  type PageInsightsRange,
  type PageInsightsTimeSeriesPoint,
} from '@fbuploadpro/contracts';

export interface PageOverviewResult {
  overview: PageInsightsOverview;
  healthStatus: PageInsightsHealthStatus;
  rawError?: string;
}

export async function getPageOverview(
  fbPageId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<PageOverviewResult> {
  const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(
    fbPageId
  )}?fields=name,fan_count,followers_count,picture.type(large)&access_token=${encodeURIComponent(
    accessToken
  )}`;

  try {
    const res = await fetchImpl(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      const err = data.error || {};
      const evalResult = evaluateGraphApiError(err.code, err.error_subcode);

      let healthStatus: PageInsightsHealthStatus = 'active';
      if (evalResult?.pageStatus === 'invalid_token') {
        healthStatus = 'invalid_token';
      } else if (evalResult?.pageStatus === 'fb_rate_limited') {
        healthStatus = 'rate_limited';
      } else {
        const msg = String(err.message || '').toLowerCase();
        if (msg.includes('two factor') || msg.includes('two-factor') || msg.includes('2fa')) {
          healthStatus = '2fa_required_on_BM';
        } else if (msg.includes('log in') || msg.includes('confirm identity')) {
          healthStatus = 'fb_verification_required';
        } else if (msg.includes('suspended')) {
          healthStatus = 'account_suspended';
        } else if (err.code === 190) {
          healthStatus = 'invalid_token';
        }
      }

      return {
        overview: {
          pageName: null,
          pageImage: null,
          fanCount: 0,
          followersCount: 0,
          totalMediaViews: 0,
          totalVideoViews: 0,
          totalPostEngagements: 0,
        },
        healthStatus,
        rawError: err.message || `Graph request failed with status ${res.status}`,
      };
    }

    const fanCount = typeof data.fan_count === 'number' ? Math.max(0, data.fan_count) : 0;
    const followersCount =
      typeof data.followers_count === 'number' ? Math.max(0, data.followers_count) : fanCount;
    const pageName = data.name || null;
    const pageImage = data.picture?.data?.url || null;

    return {
      overview: {
        pageName,
        pageImage,
        fanCount,
        followersCount,
        totalMediaViews: 0,
        totalVideoViews: 0,
        totalPostEngagements: 0,
      },
      healthStatus: 'active',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    return {
      overview: {
        pageName: null,
        pageImage: null,
        fanCount: 0,
        followersCount: 0,
        totalMediaViews: 0,
        totalVideoViews: 0,
        totalPostEngagements: 0,
      },
      healthStatus: 'active',
      rawError: message,
    };
  }
}

export interface PageTimeSeriesResult {
  timeSeries: PageInsightsTimeSeriesPoint[];
  totalMediaViews: number;
  totalVideoViews: number;
  totalVideoViewTimeMinutes: number;
}

export function getDaysForRange(range: PageInsightsRange): number {
  switch (range) {
    case '7d':
      return 7;
    case '14d':
      return 14;
    case '90d':
      return 90;
    case '28d':
    default:
      return 28;
  }
}

export async function getPageTimeSeriesInsights(
  fbPageId: string,
  accessToken: string,
  range: PageInsightsRange = '28d',
  fetchImpl: typeof fetch = fetch
): Promise<PageTimeSeriesResult> {
  const days = getDaysForRange(range);
  const now = new Date();
  const untilEpoch = Math.floor(now.getTime() / 1000);
  const sinceDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceEpoch = Math.floor(sinceDate.getTime() / 1000);

  // Initialize continuous chronological day map with zero values
  const daysMap = new Map<string, PageInsightsTimeSeriesPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    daysMap.set(dateStr, {
      date: dateStr,
      pageFollows: 0,
      dailyFollowsUnique: 0,
      dailyUnfollowsUnique: 0,
      mediaViews: 0,
      videoViews: 0,
      videoCompleteViews30s: 0,
      videoViewTimeMinutes: 0,
    });
  }

  const metrics = [
    'page_follows',
    'page_daily_follows_unique',
    'page_daily_unfollows_unique',
    'page_media_view',
    'page_video_views',
    'page_video_complete_views_30s',
    'page_video_view_time',
  ].join(',');

  const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(
    fbPageId
  )}/insights?metric=${metrics}&period=day&since=${sinceEpoch}&until=${untilEpoch}&access_token=${encodeURIComponent(
    accessToken
  )}`;

  let totalMediaViews = 0;
  let totalVideoViews = 0;
  let totalVideoViewTimeMinutes = 0;

  try {
    const res = await fetchImpl(url);
    const payload = await res.json();

    if (res.ok && Array.isArray(payload.data)) {
      for (const metric of payload.data) {
        const metricName = metric.name;
        if (!Array.isArray(metric.values)) continue;

        for (const item of metric.values) {
          if (!item.end_time) continue;
          const dateStr = String(item.end_time).slice(0, 10);
          const rawVal = typeof item.value === 'number' ? Math.max(0, item.value) : 0;

          const point = daysMap.get(dateStr);
          if (!point) continue;

          switch (metricName) {
            case 'page_follows':
              point.pageFollows = rawVal;
              break;
            case 'page_daily_follows_unique':
              point.dailyFollowsUnique = rawVal;
              break;
            case 'page_daily_unfollows_unique':
              point.dailyUnfollowsUnique = rawVal;
              break;
            case 'page_media_view':
              point.mediaViews = rawVal;
              totalMediaViews += rawVal;
              break;
            case 'page_video_views':
              point.videoViews = rawVal;
              totalVideoViews += rawVal;
              break;
            case 'page_video_complete_views_30s':
              point.videoCompleteViews30s = rawVal;
              break;
            case 'page_video_view_time': {
              const minutes =
                rawVal > 1000
                  ? Math.round((rawVal / 60000) * 10) / 10
                  : Math.round((rawVal / 60) * 10) / 10;
              point.videoViewTimeMinutes = minutes;
              totalVideoViewTimeMinutes += minutes;
              break;
            }
          }
        }
      }
    }
  } catch (_e) {
    // If Graph API fails, return the initialized zero-filled array gracefully
  }

  const timeSeries = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    timeSeries,
    totalMediaViews,
    totalVideoViews,
    totalVideoViewTimeMinutes,
  };
}
