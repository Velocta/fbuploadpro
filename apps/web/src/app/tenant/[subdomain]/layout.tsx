import React from 'react';
import Link from 'next/link';
import { getServerSessionContext } from '../../../lib/auth';
import { THEME, COMPONENT_STYLES } from '@/lib/theme';

interface TenantLayoutProps {
  params: Promise<{ subdomain: string }>;
  children: React.ReactNode;
}

export default async function TenantLayout({ params, children }: TenantLayoutProps) {
  const { subdomain } = await params;
  const session = await getServerSessionContext();
  const role = session?.role || 'user';

  const navLinks = [
    { href: `/tenant/${subdomain}/dashboard`, label: 'Dashboard' },
    { href: `/tenant/${subdomain}/accounts`, label: 'Facebook Pages' },
    { href: `/tenant/${subdomain}/media`, label: 'Media Library' },
    { href: `/tenant/${subdomain}/publishing`, label: 'Publishing Queue' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: THEME.default.surfaces.canvas,
        color: THEME.default.text.primary,
        fontFamily: THEME.default.typography.fontFamily,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${THEME.default.spacing.xl}`,
          height: '56px',
          backgroundColor: THEME.default.surfaces.panel,
          borderBottom: `1px solid ${THEME.default.borders.hairline}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: THEME.default.spacing.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: THEME.default.spacing.sm }}>
            <Link
              href={`/tenant/${subdomain}/dashboard`}
              style={{
                textDecoration: 'none',
                color: THEME.default.text.primary,
                fontWeight: THEME.default.typography.weights.bold,
                fontSize: '1rem',
                letterSpacing: THEME.default.typography.tracking.h3,
              }}
            >
              FBUploadPro
            </Link>
            <span
              style={{
                fontSize: '0.75rem',
                color: THEME.default.text.muted,
                fontFamily: 'monospace',
              }}
            >
              /{subdomain}
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: THEME.default.spacing.md }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  textDecoration: 'none',
                  color: THEME.default.text.secondary,
                  fontSize: '0.8125rem',
                  fontWeight: THEME.default.typography.weights.medium,
                  padding: `${THEME.default.spacing.xs} ${THEME.default.spacing.sm}`,
                  borderRadius: THEME.default.radii.xs,
                  transition: 'color 0.15s ease',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: THEME.default.spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: THEME.default.spacing.xs }}>
            <span style={COMPONENT_STYLES.statusDot('operational')} />
            <span
              style={{
                fontSize: '0.75rem',
                color: THEME.default.text.secondary,
                fontWeight: THEME.default.typography.weights.semibold,
                textTransform: 'uppercase',
                letterSpacing: THEME.default.typography.tracking.caption,
              }}
            >
              {role}
            </span>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: THEME.default.spacing.xl }}>
        {children}
      </main>
    </div>
  );
}
