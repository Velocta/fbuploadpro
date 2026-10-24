'use client';

/**
 * Insights time-series chart (spec 131 PR-131-3) — split out of
 * tab-insights.tsx so `recharts` loads behind `next/dynamic` and never
 * ships in the section frame's initial bundle (spec §8.5). Colours are
 * token CSS variables, never literals.
 */

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { PageInsightsTimeSeriesPoint } from '@/lib/api/schemas/pages';

function formatChartDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function InsightsChart({
  timeSeries,
}: Readonly<{ timeSeries: PageInsightsTimeSeriesPoint[] }>) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-brand-gold)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-brand-gold)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-signal-operational)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-signal-operational)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            stroke="var(--color-ink-sub)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis stroke="var(--color-ink-sub)" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-panel)',
              borderColor: 'var(--color-line)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-ink)',
              fontSize: '0.8125rem',
            }}
          />
          <Area
            type="monotone"
            dataKey="pageFollows"
            name="Followers"
            stroke="var(--color-brand-gold)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#amberGradient)"
          />
          <Area
            type="monotone"
            dataKey="mediaViews"
            name="Impressions & Views"
            stroke="var(--color-signal-operational)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#viewsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
