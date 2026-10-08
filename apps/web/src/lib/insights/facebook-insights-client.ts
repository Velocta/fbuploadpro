import {
  evaluateGraphApiError,
  type PageInsightsHealthStatus,
  type PageInsightsOverview,
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
