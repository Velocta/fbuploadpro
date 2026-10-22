'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { InstagramIcon } from '@/components/workspace/platform-nav-config';
import { ByocGate } from '@/components/connect/byoc-gate';
import { COMPONENT_STYLES, SPACING } from '@/lib/theme';

export default function InstagramAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="Instagram"
      subdomain={subdomain}
      icon={<InstagramIcon size={24} />}
      description="Connect your Instagram account to schedule and publish posts from one place. Your workspace uses its own Instagram app details, so your accounts stay yours."
      connectArea={
        <ByocGate platform="instagram" platformName="Instagram" subdomain={subdomain}>
          <a
            href={`/api/connect/instagram?subdomain=${encodeURIComponent(subdomain)}`}
            data-testid="instagram-connect-link"
            style={{
              ...COMPONENT_STYLES.primaryButton,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '38px',
              padding: `0 ${SPACING.lg}`,
              fontSize: '0.875rem',
            }}
          >
            Connect Instagram
          </a>
        </ByocGate>
      }
    />
  );
}
