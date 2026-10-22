'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformPlaceholderAccounts } from '@/components/workspace/platform-placeholder-accounts';
import { TikTokIcon } from '@/components/workspace/platform-nav-config';

export default function TikTokAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformPlaceholderAccounts
      platformName="TikTok"
      subdomain={subdomain}
      icon={<TikTokIcon size={24} />}
      description="You connect your account through our publishing partner — there is nothing to set up or paste here. When you connect, you sign in with TikTok and approve the connection."
    />
  );
}
