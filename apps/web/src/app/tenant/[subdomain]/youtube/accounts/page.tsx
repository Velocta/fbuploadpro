'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { YouTubeIcon } from '@/components/workspace/platform-nav-config';

export default function YouTubeAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="YouTube"
      subdomain={subdomain}
      icon={<YouTubeIcon size={24} />}
      description="You connect your channel through our publishing partner — there is nothing to set up or paste here. When you connect, you sign in with YouTube, approve the connection, and pick your channel."
    />
  );
}
