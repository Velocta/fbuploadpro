'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
  STATUS_SIGNALS,
} from '@/lib/theme';
import type { FacebookPageItem } from '../page-card';
import type { PageInsightsResponse, PageInsightsRange } from '@fbuploadpro/contracts';

export interface PageTabInsightsProps {
  page: FacebookPageItem;
  subdomain: string;
}

export function PageTabInsights({
  page,
  subdomain,
}: Readonly<PageTabInsightsProps>) {
  const [range, setRange] = useState<PageInsightsRange>('28d');
  const [data, setData] = useState<PageInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchInsights = async (rangeValue: PageInsightsRange, forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const url = `/api/tenant/${subdomain}/pages/${page.id}/insights?range=${rangeValue}${
        forceRefresh ? '&refresh=true' : ''
      }`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Unable to fetch page insights');
      }
      const responseJson: PageInsightsResponse = await res.json();
      setData(responseJson);
    } catch (err: any) {
      setError(err.message || 'Failed to load insights data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (page.id && subdomain) {
      void fetchInsights(range, false);
    }
  }, [page.id, subdomain, range]);

  const handleRangeChange = (newRange: PageInsightsRange) => {
    setRange(newRange);
  };

  const handleManualRefresh = () => {
    void fetchInsights(range, true);
  };

  const formatChartDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div data-testid="page-tab-insights" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
      {/* Top Controls: Range Switcher & Refresh */}
      <div
        data-testid="insights-controls-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: SPACING.md,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Page Performance & Insights
          </h3>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Direct metrics from Facebook Graph API v26.0 for {page.pageName}.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          {/* Range Buttons */}
          <div
            style={{
              display: 'flex',
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              padding: '2px',
              borderRadius: RADII.sm,
            }}
          >
            {(['7d', '14d', '28d', '90d'] as const).map((r) => {
              const isSelected = range === r;
              return (
                <button
                  key={r}
                  type="button"
                  data-testid={`range-btn-${r}`}
                  onClick={() => handleRangeChange(r)}
                  style={{
                    padding: `${SPACING.xs} ${SPACING.sm}`,
                    borderRadius: RADII.xs,
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? TYPOGRAPHY.weights.bold : TYPOGRAPHY.weights.medium,
                    backgroundColor: isSelected
                      ? `var(--bg-panel, ${THEME.default.surfaces.panel})`
                      : 'transparent',
                    color: isSelected
                      ? `var(--text-main, ${THEME.default.text.primary})`
                      : `var(--text-sub, ${THEME.default.text.secondary})`,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: isSelected ? `var(--shadow-card, ${THEME.default.shadows.card})` : 'none',
                  }}
                >
                  {r.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            data-testid="refresh-insights-btn"
            disabled={isRefreshing || isLoading}
            onClick={handleManualRefresh}
            style={{
              padding: `${SPACING.xs} ${SPACING.sm}`,
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              backgroundColor: 'transparent',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {isRefreshing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          data-testid="insights-error-banner"
          style={{
            padding: SPACING.md,
            borderRadius: RADII.md,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: PALETTE.accent3,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={handleManualRefresh}
            style={{
              background: 'none',
              border: 'none',
              color: PALETTE.accent3,
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && (
        <div
          data-testid="insights-loading"
          style={{
            padding: SPACING.xxl,
            textAlign: 'center',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.875rem',
          }}
        >
          Loading analytics & insights...
        </div>
      )}

      {/* Main Insights Content */}
      {data && (
        <>
          {/* Key KPI Overview Cards */}
          <div
            data-testid="insights-kpi-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: SPACING.md,
            }}
          >
            <div
              style={{
                padding: SPACING.lg,
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                Total Followers
              </span>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  marginTop: SPACING.xs,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {data.overview.followersCount.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                padding: SPACING.lg,
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                Total Video Views
              </span>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  marginTop: SPACING.xs,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {data.overview.totalVideoViews.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                padding: SPACING.lg,
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                Post Engagements
              </span>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  marginTop: SPACING.xs,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {data.overview.totalPostEngagements.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                padding: SPACING.lg,
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                Total Reactions
              </span>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  marginTop: SPACING.xs,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {data.reactions.total.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Time Series Growth Chart */}
          <div
            data-testid="insights-chart-card"
            style={{
              padding: SPACING.lg,
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
            }}
          >
            <div style={{ marginBottom: SPACING.lg }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                Follower & View Trajectory
              </h4>
              <p
                style={{
                  margin: `${SPACING.xs} 0 0 0`,
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                Daily follower activity and content impressions over the selected window.
              </p>
            </div>

            {isMounted && data.timeSeries.length > 0 ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PALETTE.primary} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={PALETTE.primary} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartDate}
                      stroke={`var(--text-sub, ${THEME.default.text.secondary})`}
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis stroke={`var(--text-sub, ${THEME.default.text.secondary})`} fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                        borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                        borderRadius: RADII.sm,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        fontSize: '0.8125rem',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pageFollows"
                      name="Followers"
                      stroke={PALETTE.primary}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#amberGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                style={{
                  padding: SPACING.xl,
                  textAlign: 'center',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                }}
              >
                No time-series data available for this range.
              </div>
            )}
          </div>

          {/* Reactions & Demographics Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: SPACING.md,
            }}
          >
            {/* Reactions Breakdown */}
            <div
              data-testid="reactions-breakdown-card"
              style={{
                padding: SPACING.lg,
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  marginBottom: SPACING.md,
                }}
              >
                Engagement Reactions
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
                {[
                  { label: 'Likes', count: data.reactions.like },
                  { label: 'Loves', count: data.reactions.love },
                  { label: 'Wows', count: data.reactions.wow },
                  { label: 'Hahas', count: data.reactions.haha },
                  { label: 'Sorrows', count: data.reactions.sorry },
                  { label: 'Angers', count: data.reactions.anger },
                ].map((reaction) => {
                  const pct =
                    data.reactions.total > 0
                      ? Math.round((reaction.count / data.reactions.total) * 100)
                      : 0;

                  return (
                    <div key={reaction.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          color: `var(--text-main, ${THEME.default.text.primary})`,
                        }}
                      >
                        <span>{reaction.label}</span>
                        <span style={{ color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                          {reaction.count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '4px',
                          backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                          borderRadius: RADII.full,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: PALETTE.primary,
                            borderRadius: RADII.full,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Demographics / Audience Locations */}
            <div
              data-testid="demographics-card"
              style={{
                padding: SPACING.lg,
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  marginBottom: SPACING.md,
                }}
              >
                Top Audience Countries
              </h4>

              {data.demographics.topCountries.length === 0 ? (
                <div
                  style={{
                    padding: SPACING.md,
                    textAlign: 'center',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    fontSize: '0.8125rem',
                  }}
                >
                  Demographic location data requires additional follower volume.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
                  {data.demographics.topCountries.slice(0, 5).map((geo) => (
                    <div key={geo.name} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          color: `var(--text-main, ${THEME.default.text.primary})`,
                        }}
                      >
                        <span>{geo.name}</span>
                        <span style={{ color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                          {geo.count.toLocaleString()} ({geo.percentage}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '4px',
                          backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                          borderRadius: RADII.full,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${geo.percentage}%`,
                            height: '100%',
                            backgroundColor: PALETTE.accent4,
                            borderRadius: RADII.full,
                          }}
                        />
                      </div>
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
