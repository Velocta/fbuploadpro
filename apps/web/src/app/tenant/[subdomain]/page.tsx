import React from 'react';
import Link from 'next/link';
import { THEME, COMPONENT_STYLES } from '@/lib/theme';

interface TenantIndexPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TenantIndexPage({ params }: TenantIndexPageProps) {
  const { subdomain } = await params;

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: THEME.default.spacing.xl,
      }}
    >
      <div style={{ ...COMPONENT_STYLES.card(THEME.default), padding: THEME.default.spacing.xl }}>
        <h1
          style={{
            margin: `0 0 ${THEME.default.spacing.xs} 0`,
            fontSize: '1.5rem',
            fontWeight: THEME.default.typography.weights.bold,
            letterSpacing: THEME.default.typography.tracking.h1,
          }}
        >
          Workspace: {subdomain}
        </h1>
        <p
          style={{
            margin: `0 0 ${THEME.default.spacing.lg} 0`,
            color: THEME.default.text.secondary,
            fontSize: '0.875rem',
          }}
        >
          Welcome to your FBUploadPro workspace.
        </p>

        <Link
          href={`/tenant/${subdomain}/dashboard`}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
