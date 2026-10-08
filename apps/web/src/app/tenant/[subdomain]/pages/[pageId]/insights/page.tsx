'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import type { PageInsightsResponse, PageInsightsRange } from '@fbuploadpro/contracts';
import { InsightsHeader } from '../../../../../../components/insights/insights-header';
import { InsightsAlerts } from '../../../../../../components/insights/insights-alerts';
import { OverviewKpiCards } from '../../../../../../components/insights/kpi-scorecards';
import { GrowthChart } from '../../../../../../components/insights/growth-chart';
import { VideoMetricsChart } from '../../../../../../components/insights/video-metrics-chart';
import { ReactionsDistributionCard } from '../../../../../../components/insights/reactions-chart';
import { DemographicsCard } from '../../../../../../components/insights/demographics-bars';
import InsightsLoadingSkeleton from './loading';

interface InsightsPageProps {
  params:
    | {
        subdomain: string;
        pageId: string;
      }
    | Promise<{
        subdomain: string;
        pageId: string;
      }>;
}

export default function PageInsightsDashboard({ params }: InsightsPageProps) {
  const resolvedParams =
    params && typeof (params as any).then === 'function'
      ? use(
          params as Promise<{
            subdomain: string;
            pageId: string;
          }>
        )
      : (params as { subdomain: string; pageId: string });
  const { subdomain, pageId } = resolvedParams;

  const [range, setRange] = useState<PageInsightsRange>('28d');
  const [data, setData] = useState<PageInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchInsights = useCallback(
    async (selectedRange: PageInsightsRange, isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const queryParams = new URLSearchParams({
          range: selectedRange,
          ...(isManualRefresh ? { refresh: 'true' } : {}),
        });

        const res = await fetch(
          `/api/tenant/${encodeURIComponent(subdomain)}/pages/${encodeURIComponent(pageId)}/insights?${queryParams.toString()}`
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Failed to fetch insights (${res.status})`);
        }

        const json = (await res.json()) as PageInsightsResponse;
        setData(json);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An error occurred while loading page insights.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [subdomain, pageId]
  );

  useEffect(() => {
    fetchInsights(range, false);
  }, [fetchInsights, range]);

  const handleRangeChange = (newRange: PageInsightsRange) => {
    setRange(newRange);
  };

  const handleRefresh = () => {
    fetchInsights(range, true);
  };

  if (isLoading && !data) {
    return <InsightsLoadingSkeleton />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <InsightsHeader
        subdomain={subdomain}
        pageId={pageId}
        pageName={data?.overview?.pageName || null}
        pageImage={data?.overview?.pageImage || null}
        dateRange={range}
        onRangeChange={handleRangeChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        cachedAt={data?.cachedAt}
        cacheHit={data?.cacheHit}
      />

      {/* Health & Token Status Banner */}
      {data && (
        <InsightsAlerts
          healthStatus={data.healthStatus}
          subdomain={subdomain}
        />
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => fetchInsights(range, false)}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: '#b91c1c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Insights Content */}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* KPI Scorecards */}
          <OverviewKpiCards overview={data.overview} />

          {/* Time Series Analytics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '1.5rem',
            }}
          >
            <GrowthChart data={data.timeSeries} />
            <VideoMetricsChart data={data.timeSeries} />
          </div>

          {/* Reactions & Demographics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <ReactionsDistributionCard reactions={data.reactions} />
            <DemographicsCard demographics={data.demographics} />
          </div>
        </div>
      )}
    </div>
  );
}
