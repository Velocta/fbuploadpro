'use client';

import React from 'react';
import Link from 'next/link';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface AuthSplitLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const BrandLogo = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  >
    <rect width="32" height="32" rx="8" fill="#12141a" stroke="#1f242d" strokeWidth="1" />
    <path
      d="M8 22L16 6L24 22H19L16 16L13 22H8Z"
      fill={PALETTE.primary}
    />
    <circle cx="16" cy="11" r="2" fill="#000000" />
  </svg>
);

const FeatureCheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, marginTop: '2px' }}
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="9" fill="rgba(250, 215, 52, 0.12)" stroke={PALETTE.primary} strokeWidth="1" />
    <path
      d="M6.5 10.2L8.8 12.5L13.5 7.5"
      stroke={PALETTE.primary}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HIGHLIGHTS = [
  {
    title: 'Automated Queue Slots',
    desc: 'Set recurring daily publishing schedules per Facebook Page with 1-minute precision.',
  },
  {
    title: 'Direct R2 Storage Ingestion',
    desc: 'Upload high-definition reels and image sets straight from your browser with zero egress bottlenecks.',
  },
  {
    title: 'Native Graph API v26.0 Delivery',
    desc: 'Official direct publishing to Facebook Reels and Feed with automated first comments on launch.',
  },
  {
    title: 'Dedicated Page Insights',
    desc: 'Real-time monitoring of follower growth, video watch minutes, impressions, and audience reactions.',
  },
];

export function AuthSplitLayout({
  title,
  description,
  children,
  footer,
}: AuthSplitLayoutProps) {
  return (
    <>
      <style>{`
        .auth-split-wrapper {
          min-height: 100vh;
          display: flex;
          width: 100%;
          background-color: var(--bg-canvas, #000000);
          color: var(--text-main, #ffffff);
          font-family: ${TYPOGRAPHY.fontFamily};
        }
        .auth-showcase-panel {
          flex: 1 1 50%;
          max-width: 50%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 56px;
          background: radial-gradient(circle at 18% 22%, rgba(250, 215, 52, 0.08) 0%, transparent 60%), #000000;
          border-right: 1px solid var(--border-subtle, #1f242d);
          box-sizing: border-box;
          position: relative;
        }
        .auth-form-panel {
          flex: 1 1 50%;
          max-width: 50%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          box-sizing: border-box;
          background-color: var(--bg-canvas, #000000);
        }
        .auth-form-box {
          max-width: 440px;
          width: 100%;
          display: flex;
          flex-direction: column;
        }
        .auth-mobile-header {
          display: none;
        }
        @media (max-width: 1023px) {
          .auth-showcase-panel {
            display: none !important;
          }
          .auth-form-panel {
            flex: 1 1 100% !important;
            max-width: 100% !important;
            padding: 32px 16px !important;
          }
          .auth-mobile-header {
            display: flex !important;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 24px;
          }
        }
      `}</style>

      <div className="auth-split-wrapper">
        {/* Left Column: Brand & Value Showcase */}
        <section className="auth-showcase-panel" aria-label="FBUploadPro Showcase">
          <div>
            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACING.md,
                textDecoration: 'none',
                color: 'var(--text-main, #ffffff)',
              }}
            >
              <BrandLogo />
              <span
                style={{
                  fontSize: '1.125rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  letterSpacing: TYPOGRAPHY.tracking.h3,
                }}
              >
                FBUploadPro
              </span>
            </Link>

            <div style={{ marginTop: '56px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: SPACING.xs,
                  padding: '4px 10px',
                  borderRadius: RADII.xs,
                  backgroundColor: 'rgba(250, 215, 52, 0.10)',
                  border: `1px solid rgba(250, 215, 52, 0.25)`,
                  fontSize: '0.75rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: PALETTE.primary,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: SPACING.md,
                }}
              >
                Cloud-Native Publishing Engine
              </div>

              <h1
                style={{
                  fontSize: '2.125rem',
                  lineHeight: 1.2,
                  fontWeight: TYPOGRAPHY.weights.heavy,
                  letterSpacing: TYPOGRAPHY.tracking.h1,
                  margin: `0 0 ${SPACING.md} 0`,
                  color: '#ffffff',
                }}
              >
                Automate Facebook publishing with precision.
              </h1>

              <p
                style={{
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                  color: 'var(--text-sub, #9ca3af)',
                  margin: `0 0 ${SPACING.xxl} 0`,
                  maxWidth: '520px',
                }}
              >
                Engineered for creators, digital marketers, and media operators to schedule, queue, and publish reels and photos across multiple pages seamlessly.
              </p>

              {/* Highlights List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
                {HIGHLIGHTS.map((item) => (
                  <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: SPACING.md }}>
                    <FeatureCheckIcon />
                    <div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: TYPOGRAPHY.weights.semibold,
                          color: '#ffffff',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-dim, #6b7280)',
                          marginTop: '2px',
                          lineHeight: 1.4,
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer note on showcase */}
          <div
            style={{
              paddingTop: SPACING.xl,
              borderTop: '1px solid var(--border-subtle, #1f242d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-dim, #6b7280)',
            }}
          >
            <span>Multi-tenant data isolation</span>
            <span>Unrestricted publishing entitlement</span>
          </div>
        </section>

        {/* Right Column: Focused Auth Form */}
        <main className="auth-form-panel">
          <div className="auth-form-box">
            {/* Mobile Header (rendered when screen < 1024px) */}
            <div className="auth-mobile-header">
              <BrandLogo />
              <span
                style={{
                  fontSize: '1.125rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  letterSpacing: TYPOGRAPHY.tracking.h3,
                }}
              >
                FBUploadPro
              </span>
            </div>

            {/* Auth Card Container */}
            <div
              style={{
                backgroundColor: 'var(--bg-panel, #0b0e14)',
                border: '1px solid var(--border-subtle, #1f242d)',
                borderRadius: RADII.md,
                padding: '32px 28px',
                boxSizing: 'border-box',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div style={{ marginBottom: SPACING.xl }}>
                <h2
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: TYPOGRAPHY.weights.bold,
                    letterSpacing: TYPOGRAPHY.tracking.h2,
                    margin: `0 0 ${SPACING.xs} 0`,
                    color: 'var(--text-main, #ffffff)',
                  }}
                >
                  {title}
                </h2>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-sub, #9ca3af)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
              </div>

              {children}

              {footer && (
                <div
                  style={{
                    marginTop: SPACING.xl,
                    paddingTop: SPACING.lg,
                    borderTop: '1px solid var(--border-subtle, #1f242d)',
                    textAlign: 'center',
                  }}
                >
                  {footer}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
