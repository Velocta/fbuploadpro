'use client';

import React, { useState } from 'react';
import {
  StatusDot,
  Tag,
  Skeleton,
  Alert,
  Tooltip,
  Button,
  Switch,
} from '@web/components/ui';

export function FeedbackShowcase() {
  const [isSkeletonLoading, setIsSkeletonLoading] = useState(true);
  const [activeAlerts, setActiveAlerts] = useState({
    info: true,
    success: true,
    warning: true,
    error: true,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Status Signals (Strictly Unboxed 6px Luminous Micro-Dots) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Status Signals (Unboxed 6px Luminous Micro-Dots — ZERO Capsule Pill Badges)
        </h3>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '32px',
            padding: '20px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
          }}
        >
          <StatusDot status="operational" label="Database Master (Operational)" />
          <StatusDot status="queued" label="Publishing Worker (Queued)" />
          <StatusDot status="critical" label="Graph API Token (Critical)" />
          <StatusDot status="idle" label="Backup Engine (Idle)" />
        </div>
      </section>

      {/* 2. Rectilinear 4px Metadata Tags */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Metadata Tags (Strict 4px Rectilinear Border Radius)
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Tag variant="default">DEFAULT TAG</Tag>
          <Tag variant="primary">CRON ACTIVE</Tag>
          <Tag variant="accent">FEATURED</Tag>
          <Tag variant="success">HEALTHY</Tag>
          <Tag variant="warning">EXPIRING SOON</Tag>
          <Tag variant="danger">RATE LIMITED</Tag>
        </div>
      </section>

      {/* 3. Skeleton Loading Shimmers */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--text-main)',
            }}
          >
            Skeleton Shimmer Placeholders (Zero CLS)
          </h3>
          <Switch
            label="Simulate Loading State"
            checked={isSkeletonLoading}
            onCheckedChange={setIsSkeletonLoading}
          />
        </div>

        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
          }}
        >
          {isSkeletonLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Skeleton variant="circle" width="48px" height="48px" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton variant="text" width="60%" height="16px" />
                <Skeleton variant="text" width="90%" height="12px" />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--primary)',
                  color: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                FB
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                  Primary Brand Facebook Page
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-sub)' }}>
                  Connected via OAuth 2.0 • 1,248,000 active followers
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Alert Banners */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--text-main)',
            }}
          >
            System Callout Alerts
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setActiveAlerts({ info: true, success: true, warning: true, error: true })
            }
          >
            Reset Alerts
          </Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeAlerts.info && (
            <Alert
              severity="info"
              title="Cloudflare Edge Optimization"
              message="Worker cron triggers are executing across 300+ global data centers."
              onClose={() => setActiveAlerts((prev) => ({ ...prev, info: false }))}
            />
          )}
          {activeAlerts.success && (
            <Alert
              severity="success"
              title="Batch Publication Complete"
              message="12 Facebook Reels were published without API errors."
              onClose={() => setActiveAlerts((prev) => ({ ...prev, success: false }))}
            />
          )}
          {activeAlerts.warning && (
            <Alert
              severity="warning"
              title="Graph API Quota Warning"
              message="Approaching 80% of daily Facebook rate limits for page ID #849201."
              onClose={() => setActiveAlerts((prev) => ({ ...prev, warning: false }))}
            />
          )}
          {activeAlerts.error && (
            <Alert
              severity="error"
              title="Token Authentication Fault"
              message="The user revoked Page Publishing permissions. Re-authentication required."
              onClose={() => setActiveAlerts((prev) => ({ ...prev, error: false }))}
            />
          )}
        </div>
      </section>

      {/* 5. Tooltip Micro-Popovers */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
            color: 'var(--text-main)',
          }}
        >
          Floating Tooltip Popovers (Hover & Focus Triggers)
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
          <Tooltip content="Tooltip positioned on top (Default)" side="top">
            <Button variant="secondary">Hover Me (Top)</Button>
          </Tooltip>

          <Tooltip content="Tooltip positioned on right side" side="right">
            <Button variant="secondary">Hover Me (Right)</Button>
          </Tooltip>

          <Tooltip content="Tooltip positioned beneath trigger" side="bottom">
            <Button variant="secondary">Hover Me (Bottom)</Button>
          </Tooltip>

          <Tooltip content="Tooltip positioned on left side" side="left">
            <Button variant="secondary">Hover Me (Left)</Button>
          </Tooltip>
        </div>
      </section>
    </div>
  );
}
