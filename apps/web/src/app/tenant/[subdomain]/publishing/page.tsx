import React from 'react';
import { THEME, COMPONENT_STYLES } from '@/lib/theme';

interface PublishingPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function PublishingPage({ params }: PublishingPageProps) {
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
            Publishing Queue & Slots
          </h1>
          <p style={{ margin: 0, color: THEME.default.text.secondary, fontSize: '0.875rem' }}>
            Automated publishing engine and slot dispatcher for tenant {subdomain}.
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
        <p style={{ color: THEME.default.text.secondary, margin: 0, fontSize: '0.875rem' }}>
          Publishing queue module ready for new design system component primitives.
        </p>
      </div>
    </div>
  );
}
