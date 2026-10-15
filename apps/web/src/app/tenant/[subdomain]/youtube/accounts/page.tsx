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
    />
  );
}
