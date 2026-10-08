import {
  evaluateGraphApiError,
  type PageInsightsHealthStatus,
  type PageInsightsOverview,
  type PageInsightsRange,
  type PageInsightsTimeSeriesPoint,
  type PageInsightsDemographics,
  type PageInsightsReactions,
  type DemographicItem,
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

export interface PageReactionsAndDemographicsResult {
  reactions: PageInsightsReactions;
  demographics: PageInsightsDemographics;
}

export function parseDemographicsDict(
  rawDict: Record<string, unknown> | undefined
): DemographicItem[] {
  if (!rawDict || typeof rawDict !== 'object') return [];

  const items: Array<{ name: string; count: number }> = [];
  for (const [key, val] of Object.entries(rawDict)) {
    const count = typeof val === 'number' ? Math.max(0, val) : 0;
    if (count > 0) {
      items.push({ name: key, count });
    }
  }

  items.sort((a, b) => b.count - a.count);
  const top7 = items.slice(0, 7);
  const total = top7.reduce((sum, item) => sum + item.count, 0);

  return top7.map((item) => ({
    name: item.name,
    count: item.count,
    percentage: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0,
  }));
}

export async function getPageReactionsAndDemographics(
  fbPageId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<PageReactionsAndDemographicsResult> {
  const reactions: PageInsightsReactions = {
    like: 0,
    love: 0,
    wow: 0,
    haha: 0,
    sorry: 0,
    anger: 0,
    total: 0,
  };

  const demographics: PageInsightsDemographics = {
    topCountries: [],
    topCities: [],
  };

  const metrics = [
    'page_actions_post_reactions_like_total',
    'page_actions_post_reactions_love_total',
    'page_actions_post_reactions_wow_total',
    'page_actions_post_reactions_haha_total',
    'page_actions_post_reactions_sorry_total',
    'page_actions_post_reactions_anger_total',
    'page_follows_country',
    'page_follows_city',
  ].join(',');

  const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(
    fbPageId
  )}/insights?metric=${metrics}&period=days_28&access_token=${encodeURIComponent(
    accessToken
  )}`;

  try {
    const res = await fetchImpl(url);
    const payload = await res.json();

    if (res.ok && Array.isArray(payload.data)) {
      for (const item of payload.data) {
        const metricName = item.name;
        const latestVal = Array.isArray(item.values) && item.values.length > 0
          ? item.values[item.values.length - 1].value
          : undefined;

        switch (metricName) {
          case 'page_actions_post_reactions_like_total':
            if (typeof latestVal === 'number') reactions.like = Math.max(0, latestVal);
            break;
          case 'page_actions_post_reactions_love_total':
            if (typeof latestVal === 'number') reactions.love = Math.max(0, latestVal);
            break;
          case 'page_actions_post_reactions_wow_total':
            if (typeof latestVal === 'number') reactions.wow = Math.max(0, latestVal);
            break;
          case 'page_actions_post_reactions_haha_total':
            if (typeof latestVal === 'number') reactions.haha = Math.max(0, latestVal);
            break;
          case 'page_actions_post_reactions_sorry_total':
            if (typeof latestVal === 'number') reactions.sorry = Math.max(0, latestVal);
            break;
          case 'page_actions_post_reactions_anger_total':
            if (typeof latestVal === 'number') reactions.anger = Math.max(0, latestVal);
            break;
          case 'page_follows_country':
            if (latestVal && typeof latestVal === 'object') {
              demographics.topCountries = parseDemographicsDict(
                latestVal as Record<string, unknown>
              );
            }
            break;
          case 'page_follows_city':
            if (latestVal && typeof latestVal === 'object') {
              demographics.topCities = parseDemographicsDict(
                latestVal as Record<string, unknown>
              );
            }
            break;
        }
      }

      reactions.total =
        reactions.like +
        reactions.love +
        reactions.wow +
        reactions.haha +
        reactions.sorry +
        reactions.anger;
    }
  } catch (_e) {
    // Graceful fallback with empty default structures
  }

  return {
    reactions,
    demographics,
  };
}
