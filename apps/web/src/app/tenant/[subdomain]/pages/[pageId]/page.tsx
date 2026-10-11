'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
} from '@/lib/theme';
import type { FacebookPageItem } from '@/components/pages/page-card';

export interface TenantDedicatedPageViewProps {
  subdomainProp?: string | undefined;
  pageIdProp?: string | undefined;
  pageNameProp?: string | undefined;
}

export default function TenantDedicatedPageView({
  subdomainProp,
  pageIdProp,
  pageNameProp,
}: Readonly<TenantDedicatedPageViewProps> = {}) {
  const params = useParams();
  const router = useRouter();
  const subdomain = subdomainProp ?? ((params?.subdomain as string) || '');
  const pageId = pageIdProp ?? ((params?.pageId as string) || '');

  const [resolvedPage, setResolvedPage] = useState<FacebookPageItem | null>(
    null
  );

  useEffect(() => {
    if (!subdomain || !pageId || pageNameProp) return;
    let active = true;
    const loadPage = async () => {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/pages`);
        if (!res.ok || !active) return;
        const data = await res.json();
        const found = (data.pages || []).find(
          (p: FacebookPageItem) => p.id === pageId
        );
        if (found && active) {
          setResolvedPage(found);
        }
      } catch (_err) {
        // Fallback to route parameter display
      }
    };
    void loadPage();
    return () => {
      active = false;
    };
  }, [subdomain, pageId, pageNameProp]);

  const pagesListHref = `/tenant/${subdomain}/pages`;
  const headingTitle =
    pageNameProp || resolvedPage?.pageName || 'Facebook Page Workspace';

  return (
    <div
      data-testid="dedicated-page-placeholder"
      style={{
        width: '100%',
        maxWidth: '960px',
        margin: '0 auto',
        padding: SPACING.xl,
        boxSizing: 'border-box',
      }}
    >
      {/* Back Navigation */}
      <div style={{ marginBottom: SPACING.lg }}>
        <a
          href={pagesListHref}
          data-testid="back-to-pages-btn"
          onClick={(e) => {
            e.preventDefault();
            router.push(pagesListHref);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.xs,
            fontSize: '0.875rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            textDecoration: 'none',
            cursor: 'pointer',
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
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Back to Pages</span>
        </a>
      </div>

      {/* Page Header */}
      <div style={{ marginBottom: SPACING.xl }}>
        <h1
          data-testid="dedicated-page-title"
          style={{
            margin: `0 0 ${SPACING.xs} 0`,
            fontSize: '1.5rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            letterSpacing: TYPOGRAPHY.tracking.h1,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          {headingTitle}
        </h1>
        {pageId && (
          <p
            data-testid="dedicated-page-id"
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            Page reference: {pageId}
          </p>
        )}
      </div>

      {/* Placeholder Card */}
      <div
        style={{
          padding: SPACING.xxl,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: RADII.sm,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            color: PALETTE.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: SPACING.md,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>

        <h2
          style={{
            margin: `0 0 ${SPACING.sm} 0`,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Dedicated Page Management Workspace
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            maxWidth: '620px',
          }}
        >
          Publishing controls, automation toggles, scheduled queue slots, and
          daily follower insights for this Facebook Page will be managed right
          here.
        </p>
      </div>
    </div>
  );
}
