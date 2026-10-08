'use client';

import React from 'react';
import type { PageInsightsTimeSeriesPoint } from '@fbuploadpro/contracts';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export interface VideoMetricsChartProps {
  data: PageInsightsTimeSeriesPoint[];
}

function formatDateTick(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return `${monthNames[monthIdx] || parts[1]} ${day}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function VideoMetricsChart({ data }: VideoMetricsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          color: '#64748b',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#0f172a',
            margin: '0 0 0.5rem',
            textAlign: 'left',
          }}
        >
          Video Performance & Retention
        </h3>
        <p style={{ margin: '2rem 0', fontSize: '0.9rem' }}>
          No video performance data available for this period.
        </p>
      </div>
    );
  }

  const totalViews = data.reduce((sum, d) => sum + (d.videoViews || 0), 0);
  const totalComplete30s = data.reduce((sum, d) => sum + (d.videoCompleteViews30s || 0), 0);
  const totalWatchMinutes = data.reduce((sum, d) => sum + (d.videoViewTimeMinutes || 0), 0);
  const completionRate =
    totalViews > 0 ? ((totalComplete30s / totalViews) * 100).toFixed(1) : '0';

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          gap: '1rem',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: '#0f172a',
              margin: 0,
            }}
          >
            Video Performance & Retention
          </h3>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#64748b',
              margin: '0.25rem 0 0',
            }}
          >
            Video plays, 30-second completions, and cumulative watch time
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Plays: </span>
            <strong style={{ color: '#0f172a' }}>{totalViews.toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>30s Complete: </span>
            <strong style={{ color: '#059669' }}>{totalComplete30s.toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Watch Time: </span>
            <strong style={{ color: '#d97706' }}>{Math.round(totalWatchMinutes).toLocaleString()}m</strong>
          </div>
          <div
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
            }}
          >
            Completion: {completionRate}%
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateTick}
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              yAxisId="left"
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#d97706"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '0.85rem',
              }}
              labelFormatter={(label) => `Date: ${formatDateTick(String(label))}`}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '10px', fontSize: '0.8rem' }}
            />
            <Bar
              yAxisId="left"
              name="Video Plays"
              dataKey="videoViews"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              yAxisId="left"
              name="30s Completions"
              dataKey="videoCompleteViews30s"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Line
              yAxisId="right"
              type="monotone"
              name="Watch Time (min)"
              dataKey="videoViewTimeMinutes"
              stroke="#d97706"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#d97706' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
