'use client';

import React from 'react';
import type { PageInsightsHealthStatus } from '@fbuploadpro/contracts';
import Link from 'next/link';

export interface InsightsAlertsProps {
  healthStatus: PageInsightsHealthStatus;
  subdomain: string;
}

export function InsightsAlerts({ healthStatus, subdomain }: InsightsAlertsProps) {
  if (healthStatus === 'active') {
    return null;
  }

  if (healthStatus === 'invalid_token') {
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.9rem' }}>
              Access Token Expired
            </div>
            <div style={{ color: '#b45309', fontSize: '0.8rem', marginTop: '0.15rem' }}>
              The Facebook access token has expired or is invalid. Reconnect your account to resume fetching live insights.
            </div>
          </div>
        </div>

        <Link
          href={`/api/auth/facebook?subdomain=${encodeURIComponent(subdomain)}`}
          style={{
            padding: '0.45rem 1rem',
            backgroundColor: '#d97706',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          Reconnect Account
        </Link>
      </div>
    );
  }

  if (healthStatus === 'rate_limited') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '10px',
          marginBottom: '1.5rem',
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>⏳</span>
        <div>
          <div style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.9rem' }}>
            Facebook Rate Limited
          </div>
          <div style={{ color: '#3b82f6', fontSize: '0.8rem', marginTop: '0.15rem' }}>
            Facebook Graph API rate limit threshold hit. Displaying latest available cached metrics snapshot.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem 1.25rem',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '10px',
        marginBottom: '1.5rem',
      }}
    >
      <span style={{ fontSize: '1.25rem' }}>🛑</span>
      <div>
        <div style={{ fontWeight: 600, color: '#991b1b', fontSize: '0.9rem' }}>
          Status Alert: {healthStatus}
        </div>
        <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.15rem' }}>
          Facebook channel verification or status issue detected. Please check your Facebook Business Manager settings.
        </div>
      </div>
    </div>
  );
}
