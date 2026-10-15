'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { XTwitterIcon } from '@/components/workspace/platform-nav-config';

export default function XTwitterAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="X (Twitter)"
      subdomain={subdomain}
      icon={<XTwitterIcon size={24} />}
    />
  );
}
