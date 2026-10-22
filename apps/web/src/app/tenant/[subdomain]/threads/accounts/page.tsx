'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { ThreadsIcon } from '@/components/workspace/platform-nav-config';
import { ByocGate } from '@/components/connect/byoc-gate';
import { COMPONENT_STYLES, SPACING } from '@/lib/theme';

export default function ThreadsAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="Threads"
      subdomain={subdomain}
      icon={<ThreadsIcon size={24} />}
      description="Connect your Threads account to schedule and publish posts from one place. Your workspace uses its own Threads app details, so your accounts stay yours."
      connectArea={
        <ByocGate platform="threads" platformName="Threads" subdomain={subdomain}>
          <a
            href={`/api/connect/threads?subdomain=${encodeURIComponent(subdomain)}`}
            data-testid="threads-connect-link"
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
            Connect Threads
          </a>
        </ByocGate>
      }
    />
  );
}
