import React from 'react';
import Link from 'next/link';
import { getServerSessionContext } from '../../../../lib/auth';
import { assertRole } from '../../../../lib/rbac';
import { THEME, COMPONENT_STYLES } from '@/lib/theme';

interface SellerPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function SellerPortalPage({ params }: SellerPageProps) {
  const { subdomain } = await params;
  const session = await getServerSessionContext();

  if (!session) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: THEME.default.spacing.xl }}>
        <div style={{ ...COMPONENT_STYLES.card(THEME.default), padding: THEME.default.spacing.xl, textAlign: 'center' }}>
          <h2 style={{ margin: `0 0 ${THEME.default.spacing.sm} 0` }}>Unauthorized</h2>
          <p style={{ color: THEME.default.text.secondary }}>Please log in to view the seller portal.</p>
        </div>
      </div>
    );
  }

  // Enforces RBAC: Throws 403 DomainError if user role is insufficient
  assertRole(session.role, 'seller');

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: THEME.default.spacing.xl }}>
        <h1
          style={{
            margin: `0 0 ${THEME.default.spacing.xs} 0`,
            fontSize: '1.5rem',
            fontWeight: THEME.default.typography.weights.bold,
            letterSpacing: THEME.default.typography.tracking.h1,
          }}
        >
          Seller Management Portal
        </h1>
        <p style={{ margin: 0, color: THEME.default.text.secondary, fontSize: '0.875rem' }}>
          Workspace: <strong style={{ color: THEME.default.text.primary }}>{subdomain}</strong>
        </p>
      </div>

      <div style={{ ...COMPONENT_STYLES.card(THEME.default), padding: THEME.default.spacing.lg }}>
        <h2 style={{ margin: `0 0 ${THEME.default.spacing.md} 0`, fontSize: '1rem', fontWeight: THEME.default.typography.weights.semibold }}>
          Seller Capabilities
        </h2>
        <ul style={{ margin: 0, paddingLeft: THEME.default.spacing.lg, color: THEME.default.text.secondary, lineHeight: 1.8, fontSize: '0.875rem' }}>
          <li>Template Publishing & Asset Sharing</li>
          <li>Client Campaign Orchestration</li>
          <li>Automated Multi-Channel Reels Distribution</li>
        </ul>
      </div>

      <div style={{ marginTop: THEME.default.spacing.lg }}>
        <Link
          href={`/tenant/${subdomain}/dashboard`}
          style={{ color: THEME.default.text.link, textDecoration: 'none', fontSize: '0.875rem' }}
        >
          &larr; Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
