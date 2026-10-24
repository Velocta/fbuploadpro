'use client';

/**
 * Dedicated Page insights tab (spec 131 PR-131-3) — clean-room rebuild
 * on shared/ui primitives + tokens and the spec 137 data layer.
 * Legacy file was read for behavioural facts and copy only.
 *
 * Storage duty (§8.6): the 15-minute browser-storage insights cache
 * is DELETED (server-owned data never lives in browser storage, spec 137
 * §3.9) — `getCachedInsights` / `setCachedInsights` /
 * `INSIGHTS_CACHE_TTL_MS` are gone with it, and the localstorage
 * baseline row for this file is removed in this PR. Freshness is
 * preserved through React Query: the insights entry carries a 5-minute
 * `staleTime` (spec 137 §3.2.2) and the explicit Sync action refetches
 * with the route's `refresh=true` flag, as before.
 *
 * Bundle duty (§8.5): `recharts` sits behind `next/dynamic` in
 * `./tab-insights-chart` — it is not in this tab's initial chunk.
 * Types: the response is the zod-inferred `PageInsightsResponse` from
 * the typed client's schema — the file's `any` is 0.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { RefreshCwIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { api, buildTenantApiPath } from '@/lib/api';
import {
  PageInsightsResponseSchema,
  type PageInsightsRange,
  type PageInsightsResponse,
} from '@/lib/api/schemas/pages';
import { queryKeys } from '@/lib/data/query-keys';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';
import { EmptyState } from '@/components/shared/ui/empty-state';
import { Skeleton } from '@/components/shared/ui/skeleton';
import { cn } from '@/lib/utils';
import type { FacebookPageItem } from '../page-card';

const InsightsChart = dynamic(
  () => import('./tab-insights-chart').then((m) => m.InsightsChart),
  { ssr: false }
);

export type { PageInsightsRange };

function formatUpdatedAgo(cachedAt: string): string {
  const then = Date.parse(cachedAt);
  if (Number.isNaN(then)) return 'from Facebook';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'Updated just now · from Facebook';
  if (minutes < 60) return `Updated ${minutes} min ago · from Facebook`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} h ago · from Facebook`;
  return `Updated ${Math.floor(hours / 24)} d ago · from Facebook`;
}

function hasMeaningfulInsights(data: PageInsightsResponse): boolean {
  return (
    data.overview.followersCount > 0 ||
    data.overview.totalVideoViews > 0 ||
    data.overview.totalPostEngagements > 0 ||
    data.reactions.total > 0 ||
    data.timeSeries.length > 0
  );
}

export interface PageTabInsightsProps {
  page: FacebookPageItem;
  subdomain: string;
}

const cardClass = 'rounded-md border border-line bg-panel p-6';
const kpiLabelClass = 'text-body text-ink-sub';
const kpiValueClass = 'mt-1 text-xxl font-bold tabular-nums text-ink';

function BreakdownBar({
  pct,
  fillClass,
}: Readonly<{ pct: number; fillClass: string }>) {
  return (
    <svg
      aria-hidden
      className="h-1 w-full border-b border-line"
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
    >
      <rect x="0" y="0" width={Math.max(0, Math.min(100, pct))} height="3" className={fillClass} />
    </svg>
  );
}

export function PageTabInsights({
  page,
  subdomain,
}: Readonly<PageTabInsightsProps>) {
  const [range, setRange] = React.useState<PageInsightsRange>('28d');
  const refreshRef = React.useRef(false);

  const insightsPath = buildTenantApiPath(subdomain, `/pages/${page.id}/insights`);
  const tenant = queryKeys.tenant(subdomain);

  const insightsQuery = useQuery({
    queryKey: tenant.insights.page(page.id, range),
    queryFn: ({ signal }) => {
      const forceRefresh = refreshRef.current;
      refreshRef.current = false;
      return api.get(insightsPath, {
        schema: PageInsightsResponseSchema,
        query: forceRefresh ? { range, refresh: 'true' } : { range },
        signal,
      });
    },
    enabled: Boolean(page.id && subdomain),
    staleTime: 5 * 60 * 1000,
  });

  const data = insightsQuery.data ?? null;
  const isLoading = insightsQuery.isPending && !data;
  const isRefreshing = insightsQuery.isFetching && Boolean(data);
  const error = insightsQuery.isError
    ? insightsQuery.error instanceof Error
      ? insightsQuery.error.message
      : "Couldn't load page insights. Please try again."
    : null;

  const handleManualRefresh = React.useCallback(() => {
    refreshRef.current = true;
    void insightsQuery.refetch();
  }, [insightsQuery]);

  return (
    <div data-testid="page-tab-insights" className="flex flex-col gap-6">
      {/* Controls: range switcher + refresh */}
      <div
        data-testid="insights-controls-bar"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h3 className="m-0 text-lg font-semibold text-ink">Page Performance & Insights</h3>
          <p data-testid="insights-updated-line" className="mt-1 text-body text-ink-sub">
            {data ? formatUpdatedAgo(data.cachedAt) : 'from Facebook'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-sm bg-active p-0.5" role="group" aria-label="Insights range">
            {(['7d', '14d', '28d', '90d'] as const).map((r) => {
              const isSelected = range === r;
              return (
                <button
                  key={r}
                  type="button"
                  data-testid={`range-btn-${r}`}
                  aria-pressed={isSelected}
                  onClick={() => setRange(r)}
                  className={cn(
                    'min-h-11 rounded-xs px-3 text-xs cursor-pointer',
                    isSelected
                      ? 'bg-panel font-bold text-ink shadow-card'
                      : 'font-medium text-ink-sub'
                  )}
                >
                  {r.toUpperCase()}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            data-testid="refresh-insights-btn"
            aria-label="Sync insights"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCwIcon aria-hidden className={cn(isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="overflow-hidden rounded-md border border-line">
          <Banner
            variant="critical"
            data-testid="insights-error-banner"
            title={error}
            action={
              <Button type="button" variant="outline" onClick={handleManualRefresh}>
                Retry
              </Button>
            }
          />
        </div>
      )}

      {/* Loading skeleton at final geometry */}
      {isLoading && (
        <div data-testid="insights-loading" aria-busy="true" className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      )}

      {/* Empty state: no insights data yet */}
      {!isLoading && !error && (!data || !hasMeaningfulInsights(data)) && (
        <EmptyState
          type="first-use"
          data-testid="insights-empty-state"
          title="Insights will appear here after your first posts publish."
        />
      )}

      {/* Main insights content */}
      {data && hasMeaningfulInsights(data) && (
        <>
          <div
            data-testid="insights-kpi-grid"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <div className={cardClass}>
              <span className={kpiLabelClass}>Total Followers</span>
              <div className={kpiValueClass}>{data.overview.followersCount.toLocaleString()}</div>
            </div>
            <div className={cardClass}>
              <span className={kpiLabelClass}>Total Video Views</span>
              <div className={kpiValueClass}>{data.overview.totalVideoViews.toLocaleString()}</div>
            </div>
            <div className={cardClass}>
              <span className={kpiLabelClass}>Post Engagements</span>
              <div className={kpiValueClass}>{data.overview.totalPostEngagements.toLocaleString()}</div>
            </div>
            <div className={cardClass}>
              <span className={kpiLabelClass}>Total Reactions</span>
              <div className={kpiValueClass}>{data.reactions.total.toLocaleString()}</div>
            </div>
          </div>

          <div data-testid="insights-chart-card" className={cardClass}>
            <div className="mb-6">
              <h4 className="m-0 text-body font-semibold text-ink">Follower & View Trajectory</h4>
              <p className="mt-1 text-body text-ink-sub">
                Daily follower activity and content impressions over the selected window.
              </p>
            </div>

            {data.timeSeries.length > 0 ? (
              <InsightsChart timeSeries={data.timeSeries} />
            ) : (
              <p className="px-6 py-6 text-center text-body text-ink-sub">
                No time-series data available for this range.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div data-testid="reactions-breakdown-card" className={cardClass}>
              <h4 className="m-0 mb-4 text-body font-semibold text-ink">Engagement Reactions</h4>

              <div className="flex flex-col gap-2">
                {[
                  { label: 'Like', count: data.reactions.like },
                  { label: 'Love', count: data.reactions.love },
                  { label: 'Wow', count: data.reactions.wow },
                  { label: 'Haha', count: data.reactions.haha },
                  { label: 'Sad', count: data.reactions.sorry },
                  { label: 'Angry', count: data.reactions.anger },
                ].map((reaction) => {
                  const pct =
                    data.reactions.total > 0
                      ? Math.round((reaction.count / data.reactions.total) * 100)
                      : 0;

                  return (
                    <div key={reaction.label} className="flex flex-col gap-1">
                      <div className="flex justify-between text-body text-ink">
                        <span>{reaction.label}</span>
                        <span className="text-ink-sub">
                          {reaction.count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <BreakdownBar pct={pct} fillClass="fill-brand-gold" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div data-testid="demographics-card" className={cardClass}>
              <h4 className="m-0 mb-4 text-body font-semibold text-ink">Top Audience Countries</h4>

              {data.demographics.topCountries.length === 0 ? (
                <p className="px-4 py-4 text-center text-body text-ink-sub">
                  Demographic location data requires additional follower volume.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.demographics.topCountries.slice(0, 5).map((geo) => (
                    <div key={geo.name} className="flex flex-col gap-1">
                      <div className="flex justify-between text-body text-ink">
                        <span>{geo.name}</span>
                        <span className="text-ink-sub">
                          {geo.count.toLocaleString()} ({geo.percentage}%)
                        </span>
                      </div>
                      <BreakdownBar pct={geo.percentage} fillClass="fill-signal-operational" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
