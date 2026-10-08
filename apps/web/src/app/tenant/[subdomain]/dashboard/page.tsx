import React from 'react';
import Link from 'next/link';
import { THEME, COMPONENT_STYLES, STATUS_SIGNALS } from '@/lib/theme';

interface DashboardPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { subdomain } = await params;

  const modules = [
    { title: 'Facebook Pages', desc: 'Connect and manage Facebook Page assets.', href: `/tenant/${subdomain}/accounts`, signal: 'operational' as const },
    { title: 'Media Library', desc: 'Direct Cloudflare R2 uploads, folders, and captions.', href: `/tenant/${subdomain}/media`, signal: 'operational' as const },
    { title: 'Publishing Queue', desc: 'Recurring slots and automated publishing engine.', href: `/tenant/${subdomain}/publishing`, signal: 'operational' as const },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: THEME.default.spacing.xl }}>
        <h1
          style={{
            margin: `0 0 ${THEME.default.spacing.xs} 0`,
            fontSize: '1.5rem',
            fontWeight: THEME.default.typography.weights.bold,
            letterSpacing: THEME.default.typography.tracking.h1,
          }}
        >
          Workspace Overview
        </h1>
        <p style={{ margin: 0, color: THEME.default.text.secondary, fontSize: '0.875rem' }}>
          Real-time operations for tenant <span style={{ color: THEME.default.text.primary, fontWeight: 600 }}>{subdomain}</span>.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: THEME.default.spacing.lg,
        }}
      >
        {modules.map((m) => (
          <div
            key={m.href}
            style={{
              ...COMPONENT_STYLES.card(THEME.default),
              padding: THEME.default.spacing.lg,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: THEME.default.spacing.sm }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: THEME.default.typography.weights.semibold,
                  }}
                >
                  {m.title}
                </h2>
                <span style={COMPONENT_STYLES.statusDot(m.signal)} />
              </div>
              <p
                style={{
                  margin: `0 0 ${THEME.default.spacing.lg} 0`,
                  color: THEME.default.text.secondary,
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                {m.desc}
              </p>
            </div>

            <Link
              href={m.href}
              style={{
                ...COMPONENT_STYLES.secondaryButton(THEME.default),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              Open Module
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
