'use client';

import React from 'react';
import type { PageInsightsRange } from '@fbuploadpro/contracts';
import Link from 'next/link';

export interface InsightsHeaderProps {
  subdomain: string;
  pageId: string;
  pageName: string | null;
  pageImage: string | null;
  dateRange: PageInsightsRange;
  onRangeChange: (range: PageInsightsRange) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  cachedAt?: string | null | undefined;
  cacheHit?: boolean | undefined;
}

export function InsightsHeader({
  subdomain,
  pageId,
  pageName,
  pageImage,
  dateRange,
  onRangeChange,
  onRefresh,
  isRefreshing,
  cachedAt,
  cacheHit,
}: InsightsHeaderProps) {
  const ranges: PageInsightsRange[] = ['7d', '14d', '28d', '90d'];

  const formatCachedTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href={`/tenant/${subdomain}/accounts`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: '#64748b',
            textDecoration: 'none',
            transition: 'color 0.15s ease',
          }}
        >
          <span>←</span>
          <span>Back to Facebook Channels</span>
        </Link>
      </div>

      {/* Main Header Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
        }}
      >
        {/* Page Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {pageImage ? (
            <img
              src={pageImage}
              alt={pageName || 'Facebook Page'}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #e2e8f0',
                backgroundColor: '#f1f5f9',
              }}
            />
          ) : (
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#1877f2',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                fontWeight: 700,
              }}
            >
              {(pageName || 'P')[0]?.toUpperCase()}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                {pageName || 'Facebook Page Insights'}
              </h1>
              <span
                style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                {pageId}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginTop: '0.25rem',
                fontSize: '0.85rem',
                color: '#64748b',
              }}
            >
              <span>Performance &amp; Audience Intelligence</span>
              {cacheHit && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.75rem',
                    color: '#64748b',
                  }}
                >
                  ⚡ Cached (15m TTL){cachedAt ? ` at ${formatCachedTime(cachedAt)}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: Range Selector + Refresh Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Range Pills */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid #e2e8f0',
            }}
          >
            {ranges.map((r) => {
              const isSelected = r === dateRange;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRangeChange(r)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#ffffff' : 'transparent',
                    color: isSelected ? '#0f172a' : '#64748b',
                    boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#334155',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.7 : 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: isRefreshing ? 'rotate(360deg)' : 'none',
                transition: isRefreshing ? 'transform 1s linear infinite' : 'none',
              }}
            >
              🔄
            </span>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
