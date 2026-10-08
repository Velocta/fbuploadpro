'use client';

import React from 'react';
import type { PageInsightsDemographics, DemographicItem } from '@fbuploadpro/contracts';

export interface DemographicsCardProps {
  demographics: PageInsightsDemographics;
}

function DemographicList({
  title,
  items,
  badgeBg = '#eff6ff',
  badgeColor = '#1d4ed8',
  barColor = '#3b82f6',
}: {
  title: string;
  items: DemographicItem[];
  badgeBg?: string;
  badgeColor?: string;
  barColor?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: '220px' }}>
      <h4
        style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#475569',
          margin: '0 0 0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {title} ({items.length})
      </h4>

      {items.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '1rem 0' }}>
          No data available.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((item, idx) => (
            <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#94a3b8',
                      width: '16px',
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    {item.count.toLocaleString()}
                  </span>
                  <span
                    style={{
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      backgroundColor: badgeBg,
                      color: badgeColor,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {item.percentage}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  height: '6px',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                    backgroundColor: barColor,
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DemographicsCard({ demographics }: DemographicsCardProps) {
  const countries = demographics?.topCountries || [];
  const cities = demographics?.topCities || [];

  const isEmpty = countries.length === 0 && cities.length === 0;

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
        height: '100%',
      }}
    >
      <div style={{ marginBottom: '1.25rem' }}>
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: '#0f172a',
            margin: 0,
          }}
        >
          Audience Demographics
        </h3>
        <p
          style={{
            fontSize: '0.8rem',
            color: '#64748b',
            margin: '0.25rem 0 0',
          }}
        >
          Top geographic distribution of page followers (normalized)
        </p>
      </div>

      {isEmpty ? (
        <div
          style={{
            padding: '3rem 1rem',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.9rem',
          }}
        >
          No demographic data available for this page.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <DemographicList
            title="Top Countries"
            items={countries}
            badgeBg="#eff6ff"
            badgeColor="#1d4ed8"
            barColor="#3b82f6"
          />
          <DemographicList
            title="Top Cities"
            items={cities}
            badgeBg="#f0fdf4"
            badgeColor="#15803d"
            barColor="#22c55e"
          />
        </div>
      )}
    </div>
  );
}
