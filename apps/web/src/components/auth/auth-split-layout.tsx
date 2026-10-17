'use client';

import React from 'react';
import Link from 'next/link';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { BrandMark } from '@/components/brand';
import { AuthShowcasePanel } from '@/components/auth/login-showcase-panel';

export interface AuthSplitLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  formPosition?: 'left' | 'right';
  showcase?: React.ReactNode;
}

const BrandLogo = () => (
  <div
    style={{
      width: '32px',
      height: '32px',
      borderRadius: RADII.sm,
      backgroundColor: '#12141a',
      border: '1px solid #1f242d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <BrandMark size={22} />
  </div>
);



export function AuthSplitLayout({
  title,
  description,
  children,
  footer,
  formPosition = 'left',
  showcase,
}: Readonly<AuthSplitLayoutProps>) {
  const isFormLeft = formPosition === 'left';

  const showcaseNode = (
    <section
      className={`auth-showcase-panel${isFormLeft ? ' auth-showcase-right' : ''}`}
      aria-label="FBUploadPro Showcase"
      {showcase ?? <AuthShowcasePanel />}
    </section>
  );

  const formNode = (
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
  );

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
        .auth-showcase-panel.auth-showcase-right {
          border-right: none;
          border-left: 1px solid var(--border-subtle, #1f242d);
          background: radial-gradient(circle at 82% 22%, rgba(250, 215, 52, 0.08) 0%, transparent 60%), #000000;
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
          .auth-split-wrapper {
            flex-direction: column;
          }
          .auth-showcase-panel {
            display: flex !important;
            order: 1 !important;
            flex: 1 1 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            padding: 36px 20px !important;
            border-right: none !important;
            border-left: none !important;
            border-bottom: 1px solid var(--border-subtle, #1f242d) !important;
          }
          .auth-form-panel {
            order: 2 !important;
            flex: 1 1 100% !important;
            max-width: 100% !important;
            padding: 32px 16px !important;
          }
          .auth-mobile-header {
            display: none !important;
          }
        }
      `}</style>

      <div className="auth-split-wrapper">
        {isFormLeft ? (
          <>
            {formNode}
            {showcaseNode}
          </>
        ) : (
          <>
            {showcaseNode}
            {formNode}
          </>
        )}
      </div>
    </>
  );
}
