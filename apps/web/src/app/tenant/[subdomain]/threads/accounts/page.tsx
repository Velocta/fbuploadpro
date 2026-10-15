'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { ThreadsIcon } from '@/components/workspace/platform-nav-config';

export default function ThreadsAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="Threads"
      subdomain={subdomain}
      icon={<ThreadsIcon size={24} />}
    />
  );
}
