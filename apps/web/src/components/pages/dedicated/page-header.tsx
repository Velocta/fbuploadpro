'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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

export interface DedicatedPageHeaderProps {
  page: FacebookPageItem;
  subdomain: string;
  onStatusToggle: (nextStatus: 'active' | 'paused') => Promise<void>;
  onOpenAddQueue: () => void;
  onDisconnectRequest: () => void;
}

export function DedicatedPageHeader({
  page,
  subdomain,
  onStatusToggle,
  onOpenAddQueue,
  onDisconnectRequest,
}: Readonly<DedicatedPageHeaderProps>) {
  const router = useRouter();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  const isPaused = page.status === 'paused';
  const isNeedsAttention =
    page.status === 'invalid_token' ||
    page.status === 'page_checkpoint' ||
    page.status === 'fb_rate_limited';

  let statusSignal: (typeof STATUS_SIGNALS)[keyof typeof STATUS_SIGNALS] = STATUS_SIGNALS.operational;
  if (isNeedsAttention) {
    statusSignal = STATUS_SIGNALS.critical;
  } else if (isPaused) {
    statusSignal = STATUS_SIGNALS.queued;
  }

  let statusLabel = 'Active';
  if (isNeedsAttention) {
    statusLabel = 'Needs Attention';
  } else if (isPaused) {
    statusLabel = 'Automation Paused';
  }

  const fbPageUrl = `https://facebook.com/${page.fbPageId}`;

  const handleToggle = async () => {
    setIsUpdatingStatus(true);
    try {
      await onStatusToggle(isPaused ? 'active' : 'paused');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const monogram = (page.pageName || 'P')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      data-testid="dedicated-page-header"
      style={{
        marginBottom: SPACING.xl,
      }}
    >
      {/* Breadcrumb Back Link */}
      <div style={{ marginBottom: SPACING.md }}>
        <button
          type="button"
          data-testid="back-to-pages-link"
          onClick={() => router.push(`/tenant/${subdomain}/pages`)}
          style={{
            background: 'none',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.xs,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Back to Facebook Pages</span>
        </button>
      </div>

      {/* Checkpoint Reactivation Banner */}
      {(page.status === 'page_checkpoint' || (page.status as string) === 'checkpoint_required') && (
        <div
          data-testid="checkpoint-reactivation-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.md,
            padding: SPACING.md,
            marginBottom: SPACING.md,
            borderRadius: RADII.sm,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flex: '1 1 300px' }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <div style={{ fontWeight: TYPOGRAPHY.weights.semibold, fontSize: '0.875rem' }}>
                Facebook Checkpoint Verification Required
              </div>
              <div style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                Facebook requires verification in the mobile app or browser before automated publishing can resume.
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="reactivate-page-btn"
            disabled={isUpdatingStatus}
            onClick={async () => {
              setIsUpdatingStatus(true);
              try {
                const res = await fetch(`/api/tenant/${subdomain}/pages/${page.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'active' }),
                });
                if (res.ok) {
                  await onStatusToggle('active');
                }
              } catch {
                await onStatusToggle('active');
              } finally {
                setIsUpdatingStatus(false);
              }
            }}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              padding: `${SPACING.xs} ${SPACING.md}`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isUpdatingStatus ? 'Reactivating...' : 'Mark Verified & Reactivate Page'}
          </button>
        </div>
      )}

      {/* Main Header Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: SPACING.lg,
          flexWrap: 'wrap',
        }}
      >
        {/* Left Side: Avatar & Information */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
            flex: '1 1 340px',
            minWidth: 0,
          }}
        >
          {page.profilePictureUrl && failedAvatarUrl !== page.profilePictureUrl ? (
            <img
              src={page.profilePictureUrl}
              alt={page.pageName}
              data-testid="dedicated-page-avatar"
              onError={() => setFailedAvatarUrl(page.profilePictureUrl ?? '__error__')}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: RADII.md,
                objectFit: 'cover',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              data-testid="dedicated-page-avatar-fallback"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: RADII.md,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                color: PALETTE.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: TYPOGRAPHY.weights.bold,
                fontSize: '1.125rem',
                flexShrink: 0,
              }}
            >
              {monogram}
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
              <h1
                data-testid="dedicated-page-heading"
                style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  letterSpacing: TYPOGRAPHY.tracking.h1,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {page.pageName}
              </h1>

              <a
                href={fbPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="page-live-link"
                title="View live Page on Facebook"
                aria-label={`View ${page.pageName} live on Facebook`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  textDecoration: 'none',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>

            {/* Sub-row: Unboxed Status Signal + Account info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.md,
                marginTop: '4px',
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                flexWrap: 'wrap',
              }}
            >
              {/* Unboxed 6px luminous status dot */}
              <div
                data-testid="dedicated-page-status"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: statusSignal.dot,
                    boxShadow: statusSignal.halo,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: statusSignal.color, fontWeight: TYPOGRAPHY.weights.medium }}>
                  {statusLabel}
                </span>
              </div>

              {page.accountDisplayName && (
                <span>Connected via {page.accountDisplayName}</span>
              )}

              {page.category && <span>• {page.category}</span>}
            </div>
          </div>
        </div>

        {/* Right Side: Primary Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            flexWrap: 'wrap',
          }}
        >
          {/* Pause / Resume Automation Button */}
          <button
            type="button"
            data-testid="header-status-toggle-btn"
            disabled={isUpdatingStatus || isNeedsAttention}
            onClick={handleToggle}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: isPaused
                ? 'rgba(250, 215, 52, 0.12)'
                : `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              color: isPaused
                ? PALETTE.primary
                : `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: isPaused
                ? 'rgba(250, 215, 52, 0.35)'
                : `var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            {isPaused ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Resume Automation</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                <span>Pause Automation</span>
              </>
            )}
          </button>

          {/* Add to Queue Button */}
          <button
            type="button"
            data-testid="header-add-queue-btn"
            onClick={onOpenAddQueue}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
              height: '36px',
              padding: `0 ${SPACING.md}`,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add to Queue</span>
          </button>

          {/* Settings / Overflow Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              data-testid="header-settings-dropdown-btn"
              aria-label="Page actions menu"
              aria-expanded={isDropdownOpen}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              style={{
                ...COMPONENT_STYLES.secondaryButton(THEME.default),
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div
                data-testid="header-settings-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '42px',
                  zIndex: 50,
                  minWidth: '180px',
                  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  borderRadius: RADII.sm,
                  boxShadow: `var(--shadow-elevated, ${THEME.default.shadows.elevated})`,
                  padding: SPACING.xs,
                }}
              >
                <button
                  type="button"
                  data-testid="header-menu-disconnect-btn"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onDisconnectRequest();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    fontSize: '0.8125rem',
                    color: PALETTE.accent3,
                    borderRadius: RADII.xs,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.xs,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                  <span>Disconnect Page</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
