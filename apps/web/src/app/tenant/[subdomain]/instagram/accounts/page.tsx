'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { InstagramIcon } from '@/components/workspace/platform-nav-config';

export default function InstagramAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="Instagram"
      subdomain={subdomain}
      icon={<InstagramIcon size={24} />}
    />
  );
}
