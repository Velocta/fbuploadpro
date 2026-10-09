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

const ShieldCheckIcon = () => (
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
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const CloudIcon = () => (
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
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

const CommentIcon = () => (
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
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
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

const VALUE_PILLARS = [
  {
    icon: <LockIcon />,
    title: 'Zero Credential Sharing',
    desc: 'You never give away your password. Connect safely through Meta’s official authorization without risk.',
  },
  {
    icon: <CloudIcon />,
    title: '100% Cloud-Powered Automation',
    desc: 'Your scheduled reels and posts publish on time around the clock, even when your computer is turned off.',
  },
  {
    icon: <CommentIcon />,
    title: 'Automated First Comments',
    desc: 'Engage audience and share links instantly with automated first comments posted the second your content goes live.',
  },
  {
    icon: <ShieldCheckIcon />,
    title: 'Safe & Ban-Protected',
    desc: 'Uses Meta-approved official publishing standards to keep your Facebook Pages and Instagram accounts fully protected.',
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
        {/* Left Column: Brand & Security Showcase */}
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

            <div style={{ marginTop: '48px' }}>
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
                Secure Cloud Automation
              </div>

              {/* User Mandated Headline */}
              <h1
                style={{
                  fontSize: '1.875rem',
                  lineHeight: 1.3,
                  fontWeight: TYPOGRAPHY.weights.heavy,
                  letterSpacing: TYPOGRAPHY.tracking.h1,
                  margin: `0 0 ${SPACING.lg} 0`,
                  color: '#ffffff',
                }}
              >
                Automate Facebook and Instagram <span style={{ color: PALETTE.primary }}>100% on the cloud</span> without ever giving away your credentials, making this the most secure way of automation.
              </h1>

              {/* Feature Pillars (Zero Technical Jargon) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg, marginTop: SPACING.xl }}>
                {VALUE_PILLARS.map((item) => (
                  <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: SPACING.md }}>
                    {item.icon}
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
                          color: 'var(--text-sub, #9ca3af)',
                          marginTop: '3px',
                          lineHeight: 1.45,
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

          {/* Clean Trust & Security Footer */}
          <div
            style={{
              paddingTop: SPACING.lg,
              borderTop: '1px solid var(--border-subtle, #1f242d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-dim, #6b7280)',
            }}
          >
            <span>Official Meta OAuth Security</span>
            <span>Zero Password Access</span>
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
