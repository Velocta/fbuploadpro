'use client';

import React from 'react';
import type { PageInsightsOverview } from '@fbuploadpro/contracts';

export interface OverviewKpiCardsProps {
  overview: PageInsightsOverview;
}

interface KpiCardConfig {
  label: string;
  value: number;
  subtext: string;
  icon: string;
  accentColor: string;
}

export function OverviewKpiCards({ overview }: OverviewKpiCardsProps) {
  const cards: KpiCardConfig[] = [
    {
      label: 'Followers',
      value: overview.followersCount,
      subtext: 'Direct account followers',
      icon: '👥',
      accentColor: '#2563eb',
    },
    {
      label: 'Page Fans',
      value: overview.fanCount,
      subtext: 'Lifetime total page likes',
      icon: '⭐',
      accentColor: '#4f46e5',
    },
    {
      label: 'Total Media Views',
      value: overview.totalMediaViews,
      subtext: 'Cumulative photo & video views',
      icon: '👁️',
      accentColor: '#0891b2',
    },
    {
      label: 'Video Views',
      value: overview.totalVideoViews,
      subtext: 'Total aggregate video plays',
      icon: '▶️',
      accentColor: '#059669',
    },
    {
      label: 'Post Engagements',
      value: overview.totalPostEngagements,
      subtext: 'Reactions, clicks & shares',
      icon: '💬',
      accentColor: '#d97706',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'box-shadow 0.15s ease, transform 0.15s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b',
              }}
            >
              {card.label}
            </span>
            <span
              style={{
                fontSize: '1.1rem',
                opacity: 0.85,
              }}
              aria-hidden="true"
            >
              {card.icon}
            </span>
          </div>

          <div>
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.1,
                fontFeatureSettings: '"tnum"',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {card.value.toLocaleString()}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#64748b',
                marginTop: '0.35rem',
              }}
            >
              {card.subtext}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
