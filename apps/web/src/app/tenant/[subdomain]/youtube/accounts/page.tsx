'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { YouTubeIcon } from '@/components/workspace/platform-nav-config';
import { COMPONENT_STYLES, SPACING } from '@/lib/theme';

export default function YouTubeAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="YouTube"
      subdomain={subdomain}
      icon={<YouTubeIcon size={24} />}
      description="You connect your channel through our publishing partner — there is nothing to set up or paste here. When you connect, you sign in with YouTube, approve the connection, and pick your channel."
      connectArea={
        <a
          href={`/api/connect/youtube?subdomain=${encodeURIComponent(subdomain)}`}
          data-testid="youtube-connect-link"
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
          Connect YouTube
        </a>
      }
    />
  );
}
