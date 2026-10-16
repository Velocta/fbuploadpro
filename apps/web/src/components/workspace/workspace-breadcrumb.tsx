'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { THEME, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

const SIMPLE_TOP_LEVEL_LABELS: Record<string, string> = {
  media: 'Media Library',
  downloader: 'Downloader',
  'fdola-studio': 'Fdola Studio',
  settings: 'Settings',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

export function computeBreadcrumbs(pathname: string, subdomain: string): BreadcrumbSegment[] {
  if (!pathname) return [{ label: 'Home' }];
  const prefix = `/tenant/${subdomain}`;
  if (pathname === prefix || pathname === `${prefix}/`) {
    return [{ label: 'Home' }];
  }

  const subPath = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  const segments = subPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return [{ label: 'Home' }];
  }

  const first = segments[0]?.toLowerCase();
  if (first && SIMPLE_TOP_LEVEL_LABELS[first]) {
    return [{ label: SIMPLE_TOP_LEVEL_LABELS[first] }];
  }
  if (first === 'accounts') {
    return [{ label: 'Facebook' }, { label: 'Accounts' }];
  }
  if (first === 'pages') {
    if (segments.length > 1) {
      return [
        { label: 'Facebook' },
        { label: 'Pages', href: `${prefix}/pages` },
        { label: 'Details' },
      ];
    }
    return [{ label: 'Facebook' }, { label: 'Pages' }];
  }

  if (first && PLATFORM_LABELS[first]) {
    const platformLabel = PLATFORM_LABELS[first];
    if (segments[1]?.toLowerCase() === 'accounts') {
      return [{ label: platformLabel }, { label: 'Accounts' }];
    }
    return [{ label: platformLabel }];
  }

  return segments.map((seg) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replaceAll('-', ' '),
  }));
}

export interface WorkspaceBreadcrumbProps {
  subdomain: string;
}

export function WorkspaceBreadcrumb({ subdomain }: Readonly<WorkspaceBreadcrumbProps>) {
  const pathname = usePathname() || '';
  const crumbs = computeBreadcrumbs(pathname, subdomain);

  return (
    <nav
      aria-label="Breadcrumbs"
      data-slot="workspace-breadcrumb"
      data-testid="workspace-breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.xs,
        fontSize: '0.8125rem',
        lineHeight: 1,
        color: `var(--text-sub, ${THEME.default.text.secondary})`,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <React.Fragment key={`${crumb.label}-${idx}`}>
            {idx > 0 && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  flexShrink: 0,
                  opacity: 0.6,
                }}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                style={{
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                style={{
                  color: isLast
                    ? `var(--text-main, ${THEME.default.text.primary})`
                    : `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontWeight: isLast
                    ? TYPOGRAPHY.weights.medium
                    : TYPOGRAPHY.weights.regular,
                }}
              >
                {crumb.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
