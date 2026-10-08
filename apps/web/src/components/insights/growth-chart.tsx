'use client';

import React from 'react';
import type { PageInsightsTimeSeriesPoint } from '@fbuploadpro/contracts';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export interface GrowthChartProps {
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

export function GrowthChart({ data }: GrowthChartProps) {
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
          Audience Growth & Churn
        </h3>
        <p style={{ margin: '2rem 0', fontSize: '0.9rem' }}>
          No follower growth data available for this period.
        </p>
      </div>
    );
  }

  const totalGained = data.reduce((sum, d) => sum + (d.dailyFollowsUnique || 0), 0);
  const totalLost = data.reduce((sum, d) => sum + (d.dailyUnfollowsUnique || 0), 0);
  const netGrowth = totalGained - totalLost;

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
            Audience Growth & Churn
          </h3>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#64748b',
              margin: '0.25rem 0 0',
            }}
          >
            Daily unique follows gained versus unfollows over selected window
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
            <span style={{ color: '#64748b' }}>Gained: </span>
            <strong style={{ color: '#16a34a' }}>+{totalGained.toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Lost: </span>
            <strong style={{ color: '#dc2626' }}>-{totalLost.toLocaleString()}</strong>
          </div>
          <div
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: netGrowth >= 0 ? '#dcfce7' : '#fee2e2',
              color: netGrowth >= 0 ? '#15803d' : '#b91c1c',
            }}
          >
            Net: {netGrowth >= 0 ? `+${netGrowth.toLocaleString()}` : netGrowth.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="growthFollowsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="growthUnfollowsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
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
            <Area
              type="monotone"
              name="Follows Gained"
              dataKey="dailyFollowsUnique"
              stroke="#2563eb"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#growthFollowsGradient)"
            />
            <Area
              type="monotone"
              name="Unfollows"
              dataKey="dailyUnfollowsUnique"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#growthUnfollowsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
