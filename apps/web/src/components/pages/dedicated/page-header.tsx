'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  STATUS_SIGNALS,
} from '@/lib/theme';
import {
  type FacebookPageItem,
  getPageStatusRingBorder,
} from '../page-card';

export interface DedicatedPageHeaderProps {
  page: FacebookPageItem;
  subdomain: string;
  onStatusToggle: (nextStatus: 'active' | 'paused') => Promise<void>;
  onOpenAddQueue: () => void;
  onDisconnectRequest: () => void;
}

interface PageStatusDetails {
  isPaused: boolean;
  isNeedsAttention: boolean;
  statusSignal: (typeof STATUS_SIGNALS)[keyof typeof STATUS_SIGNALS];
  statusLabel: string;
}

function resolvePageStatus(status: FacebookPageItem['status']): PageStatusDetails {
  if (
    status === 'invalid_token' ||
    status === 'page_checkpoint' ||
    status === 'fb_rate_limited'
  ) {
    return {
      isPaused: false,
      isNeedsAttention: true,
      statusSignal: STATUS_SIGNALS.critical,
      statusLabel: 'Needs Attention',
    };
  }

  if (status === 'paused') {
    return {
      isPaused: true,
      isNeedsAttention: false,
      statusSignal: STATUS_SIGNALS.queued,
      statusLabel: 'Paused',
    };
  }

  return {
    isPaused: false,
    isNeedsAttention: false,
    statusSignal: STATUS_SIGNALS.operational,
    statusLabel: 'Active',
  };
}

function useDropdownDismiss(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  dropdownRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen, dropdownRef]);
}

interface CheckpointBannerProps {
  subdomain: string;
  pageId: string;
  isUpdatingStatus: boolean;
  setIsUpdatingStatus: (updating: boolean) => void;
  onStatusToggle: (status: 'active' | 'paused') => Promise<void>;
}

function CheckpointBanner({
  subdomain,
  pageId,
  isUpdatingStatus,
  setIsUpdatingStatus,
  onStatusToggle,
}: Readonly<CheckpointBannerProps>) {
  const handleReactivate = async () => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/pages/${pageId}`, {
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
  };

  return (
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          flex: '1 1 300px',
        }}
      >
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
          <div
            style={{
              fontWeight: TYPOGRAPHY.weights.semibold,
              fontSize: '0.875rem',
            }}
          >
            Facebook Checkpoint Verification Required
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Facebook requires verification in the mobile app or browser before automated publishing can resume.
          </div>
        </div>
      </div>
      <button
        type="button"
        data-testid="reactivate-page-btn"
        disabled={isUpdatingStatus}
        onClick={handleReactivate}
        style={{
          height: '34px',
          padding: `0 ${SPACING.md}`,
          backgroundColor: PALETTE.primary,
          color: '#000000',
          border: `1px solid ${PALETTE.primary}`,
          borderRadius: RADII.sm,
          fontSize: '0.8125rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        }}
      >
        {isUpdatingStatus ? 'Reactivating...' : 'Mark Verified & Reactivate Page'}
      </button>
    </div>
  );
}

function SubtitleHairlineDivider() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: '1px',
        height: '12px',
        backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
        flexShrink: 0,
      }}
    />
  );
}

function renderDedicatedAvatar(
  page: FacebookPageItem,
  failedAvatarUrl: string | null,
  setFailedAvatarUrl: React.Dispatch<React.SetStateAction<string | null>>,
  statusRingBorder: string,
  monogram: string
) {
  if (page.profilePictureUrl && failedAvatarUrl !== page.profilePictureUrl) {
    return (
      <img
        src={page.profilePictureUrl}
        alt={page.pageName}
        data-testid="dedicated-page-avatar"
        onError={() =>
          setFailedAvatarUrl(page.profilePictureUrl ?? '__error__')
        }
        style={{
          width: '44px',
          height: '44px',
          borderRadius: RADII.md,
          objectFit: 'cover',
          border: statusRingBorder,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      data-testid="dedicated-page-avatar-fallback"
      style={{
        width: '44px',
        height: '44px',
        borderRadius: RADII.md,
        backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
        border: statusRingBorder,
        color: PALETTE.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: TYPOGRAPHY.weights.bold,
        fontSize: '0.9375rem',
        flexShrink: 0,
      }}
    >
      {monogram}
    </div>
  );
}

function renderDedicatedSubtitle(
  page: FacebookPageItem,
  statusSignal: (typeof STATUS_SIGNALS)[keyof typeof STATUS_SIGNALS],
  statusLabel: string
) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        marginTop: '4px',
        fontSize: '0.8125rem',
        color: `var(--text-sub, ${THEME.default.text.secondary})`,
        flexWrap: 'wrap',
      }}
    >
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
        <span
          style={{
            color: statusSignal.color,
            fontWeight: TYPOGRAPHY.weights.medium,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {page.accountDisplayName && (
        <>
          <SubtitleHairlineDivider />
          <span>Connected via {page.accountDisplayName}</span>
        </>
      )}

      {typeof page.currentFollowers === 'number' && (
        <>
          <SubtitleHairlineDivider />
          <span>
            {page.currentFollowers.toLocaleString('en-US')} followers
          </span>
        </>
      )}

      {page.category && (
        <>
          <SubtitleHairlineDivider />
          <span>{page.category}</span>
        </>
      )}
    </div>
  );
}

function renderStatusToggleContent(isPaused: boolean, isUpdatingStatus: boolean) {
  if (isPaused) {
    return (
      <>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <span>{isUpdatingStatus ? 'Resuming...' : 'Resume Automation'}</span>
      </>
    );
  }

  return (
    <>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
      <span>{isUpdatingStatus ? 'Pausing...' : 'Pause Automation'}</span>
    </>
  );
}

interface PageMoreMenuRenderProps {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  isDropdownOpen: boolean;
  setIsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hasCopiedId: boolean;
  handleCopyId: () => Promise<void>;
  fbPageUrl: string;
  onDisconnectRequest: () => void;
}

function renderPageMoreMenu(props: PageMoreMenuRenderProps) {
  const {
    dropdownRef,
    isDropdownOpen,
    setIsDropdownOpen,
    hasCopiedId,
    handleCopyId,
    fbPageUrl,
    onDisconnectRequest,
  } = props;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid="header-settings-dropdown-btn"
        aria-label="Page actions menu"
        aria-expanded={isDropdownOpen}
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        style={{
          width: '34px',
          height: '34px',
          padding: 0,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.sm,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'color 0.12s ease, border-color 0.12s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
          e.currentTarget.style.borderColor = `var(--border-strong, ${THEME.default.borders.strong})`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
          e.currentTarget.style.borderColor = `var(--border-subtle, ${THEME.default.borders.hairline})`;
        }}
      >
        <svg
          width="15"
          height="15"
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
            top: '40px',
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
            data-testid="header-menu-copy-id-btn"
            onClick={handleCopyId}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              padding: `${SPACING.sm} ${SPACING.md}`,
              fontSize: '0.8125rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderRadius: RADII.xs,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{hasCopiedId ? 'Page ID Copied' : 'Copy Page ID'}</span>
          </button>

          <a
            href={fbPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsDropdownOpen(false)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              padding: `${SPACING.sm} ${SPACING.md}`,
              fontSize: '0.8125rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderRadius: RADII.xs,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg
              width="13"
              height="13"
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
            <span>Open on Facebook</span>
          </a>

          <div
            style={{
              height: '1px',
              backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              margin: `${SPACING.xs} 0`,
            }}
          />

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
              e.currentTarget.style.backgroundColor =
                'rgba(246, 70, 93, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg
              width="13"
              height="13"
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
  );
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
  const [hasCopiedId, setHasCopiedId] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const statusInfo = resolvePageStatus(page.status);
  const statusRingBorder = getPageStatusRingBorder(page.status);
  const monogram = (page.pageName || 'P').slice(0, 2).toUpperCase();
  const fbPageUrl = `https://facebook.com/${page.fbPageId}`;

  useDropdownDismiss(isDropdownOpen, setIsDropdownOpen, dropdownRef);

  const handleToggle = async () => {
    setIsUpdatingStatus(true);
    try {
      await onStatusToggle(statusInfo.isPaused ? 'active' : 'paused');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(page.fbPageId);
      setHasCopiedId(true);
      setTimeout(() => setHasCopiedId(false), 2000);
    } catch {
      // Clipboard fallback
    }
    setIsDropdownOpen(false);
  };

  const isCheckpoint =
    page.status === 'page_checkpoint' ||
    (page.status as string) === 'checkpoint_required';

  return (
    <div
      data-testid="dedicated-page-header"
      style={{
        marginBottom: SPACING.xl,
      }}
    >
      {/* Quiet Back Link (Option A) */}
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
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
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
          <span>Facebook Pages</span>
        </button>
      </div>

      {/* Checkpoint Reactivation Banner */}
      {isCheckpoint && (
        <CheckpointBanner
          subdomain={subdomain}
          pageId={page.id}
          isUpdatingStatus={isUpdatingStatus}
          setIsUpdatingStatus={setIsUpdatingStatus}
          onStatusToggle={onStatusToggle}
        />
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
          {renderDedicatedAvatar(
            page,
            failedAvatarUrl,
            setFailedAvatarUrl,
            statusRingBorder,
            monogram
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                flexWrap: 'wrap',
              }}
            >
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
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = `var(--text-dim, ${THEME.default.text.muted})`;
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

            {/* Sub-row: Unboxed Status Signal + Account info + Followers (Zero bullet dots) */}
            {renderDedicatedSubtitle(
              page,
              statusInfo.statusSignal,
              statusInfo.statusLabel
            )}
          </div>
        </div>

        {/* Right Side: Uniform 34px Action Buttons Cluster */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            flexWrap: 'wrap',
          }}
        >
          {/* Pause / Resume Automation Button (34px height) */}
          <button
            type="button"
            data-testid="header-status-toggle-btn"
            disabled={isUpdatingStatus || statusInfo.isNeedsAttention}
            onClick={handleToggle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: statusInfo.isPaused
                ? 'rgba(250, 215, 52, 0.1)'
                : `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              color: statusInfo.isPaused
                ? PALETTE.primary
                : `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid ${
                statusInfo.isPaused
                  ? 'rgba(250, 215, 52, 0.3)'
                  : `var(--border-subtle, ${THEME.default.borders.hairline})`
              }`,
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor:
                isUpdatingStatus || statusInfo.isNeedsAttention
                  ? 'not-allowed'
                  : 'pointer',
              transition:
                'background-color 0.12s ease, border-color 0.12s ease',
            }}
          >
            {renderStatusToggleContent(statusInfo.isPaused, isUpdatingStatus)}
          </button>

          {/* Primary Action: Queue Post (34px height) */}
          <button
            type="button"
            data-testid="header-add-queue-btn"
            onClick={onOpenAddQueue}
            style={{
              height: '34px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.primary,
              color: '#000000',
              border: `1px solid ${PALETTE.primary}`,
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
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
            <span>Queue Post</span>
          </button>

          {/* More Actions Dropdown (34x34px) */}
          {renderPageMoreMenu({
            dropdownRef,
            isDropdownOpen,
            setIsDropdownOpen,
            hasCopiedId,
            handleCopyId,
            fbPageUrl,
            onDisconnectRequest,
          })}
        </div>
      </div>
    </div>
  );
}
