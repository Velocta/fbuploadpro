import React from 'react';
import { THEME, COMPONENT_STYLES } from '@/lib/theme';

interface AccountsPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function AccountsPage({ params }: AccountsPageProps) {
  const { subdomain } = await params;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: THEME.default.spacing.xl }}>
        <div>
          <h1
            style={{
              margin: `0 0 ${THEME.default.spacing.xs} 0`,
              fontSize: '1.5rem',
              fontWeight: THEME.default.typography.weights.bold,
              letterSpacing: THEME.default.typography.tracking.h1,
            }}
          >
            Facebook Pages & Accounts
          </h1>
          <p style={{ margin: 0, color: THEME.default.text.secondary, fontSize: '0.875rem' }}>
            Manage OAuth connections and discovered pages for tenant {subdomain}.
          </p>
        </div>
      </div>

      <div
        style={{
          ...COMPONENT_STYLES.card(THEME.default),
          padding: THEME.default.spacing.xxl,
          textAlign: 'center',
        }}
      >
        <p style={{ color: THEME.default.text.secondary, margin: `0 0 ${THEME.default.spacing.lg} 0`, fontSize: '0.875rem' }}>
          Connect a Facebook account via OAuth to discover and publish to your pages.
        </p>
        <a
          href="/api/auth/facebook"
          style={{
            ...COMPONENT_STYLES.primaryButton,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Connect Facebook Account
        </a>
      </div>
    </div>
  );
}
