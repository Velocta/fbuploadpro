'use client';

import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand';
import { PALETTE, RADII, SPACING, THEME, TYPOGRAPHY } from '@/lib/theme';

const ClockIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={PALETTE.primary}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, marginTop: '2px' }}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const GridIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={PALETTE.primary}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, marginTop: '2px' }}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={PALETTE.primary}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, marginTop: '2px' }}
    aria-hidden="true"
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const FEATURES: readonly FeatureItem[] = [
  {
    icon: <ClockIcon />,
    title: 'Post from anywhere',
    desc: 'Schedule from your phone or laptop — your posts publish from the cloud.',
  },
  {
    icon: <GridIcon />,
    title: 'Every platform, one dashboard',
    desc: 'Connect each account once, then run everything from a single place.',
  },
  {
    icon: <LockIcon />,
    title: 'Your accounts stay yours',
    desc: 'You sign in through each platform directly — your passwords never leave them.',
  },
] as const;

export function AuthShowcasePanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: '100%',
      }}
    >
      <div>
        {/* 1. Brand Row */}
        <Link
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.md,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: RADII.sm,
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BrandMark size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                letterSpacing: TYPOGRAPHY.tracking.h3,
                lineHeight: 1.25,
              }}
            >
              FBUploadPro
            </span>
            <span
              style={{
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                lineHeight: 1.3,
              }}
            >
              Content automation for creators
            </span>
          </div>
        </Link>

        {/* Generous whitespace before main showcase content */}
        <div style={{ marginTop: SPACING.xxxl }}>
          {/* 2. Eyebrow Label (Unboxed, Accent Color, Uppercase, Wide Tracking) */}
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: PALETTE.primary,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: SPACING.md,
            }}
          >
            CREATE · SCHEDULE · GROW
          </div>

          {/* 3. Headline (3 lines with line breaks, 3rd line accent) */}
          <h1
            style={{
              fontSize: '2rem',
              lineHeight: 1.25,
              fontWeight: TYPOGRAPHY.weights.heavy,
              letterSpacing: TYPOGRAPHY.tracking.h1,
              margin: `0 0 ${SPACING.lg} 0`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Your pages,<br />
            posting themselves —<br />
            <span style={{ color: PALETTE.primary }}>100% on the cloud.</span>
          </h1>

          {/* 4. Subtext (~420px max-width, secondary color) */}
          <p
            style={{
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              maxWidth: '420px',
              margin: `0 0 ${SPACING.xl} 0`,
            }}
          >
            Schedule reels and posts across Facebook, Instagram, TikTok, YouTube, Threads, and X — they go live while you sleep, even when your laptop is closed.
          </p>

          {/* 5. Feature List (3 rows separated by hairline dividers) */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {FEATURES.map((item, index) => (
              <div
                key={item.title}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: SPACING.md,
                  paddingTop: index === 0 ? 0 : SPACING.lg,
                  paddingBottom: index === FEATURES.length - 1 ? 0 : SPACING.lg,
                  borderBottom:
                    index < FEATURES.length - 1
                      ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
                      : undefined,
                }}
              >
                {item.icon}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: TYPOGRAPHY.weights.semibold,
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: `var(--text-sub, ${THEME.default.text.secondary})`,
                      marginTop: SPACING.xs,
                      lineHeight: 1.45,
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 6. Platform Line (Muted, Small) */}
          <div
            style={{
              marginTop: SPACING.xl,
              marginBottom: SPACING.xl,
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              letterSpacing: '0.02em',
            }}
          >
            Facebook · Instagram · TikTok · YouTube · Threads · X
          </div>
        </div>
      </div>

      {/* 7. Footer Row (Left-aligned, muted, small, NO "See how it works" link) */}
      <div
        style={{
          paddingTop: SPACING.lg,
          borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          fontSize: '0.75rem',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        <span>Official platform logins · Encrypted end-to-end</span>
      </div>
    </div>
  );
}
export const LoginShowcasePanel = AuthShowcasePanel;

