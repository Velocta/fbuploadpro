'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformAccountsShell } from '@/components/accounts/platform-accounts-shell';
import { TikTokIcon } from '@/components/workspace/platform-nav-config';
import { Button } from '@/components/shared/ui/button';

export default function TikTokAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformAccountsShell
      platformName="TikTok"
      subdomain={subdomain}
      icon={<TikTokIcon size={24} />}
      description="You connect your account through our publishing partner — there is nothing to set up or paste here. When you connect, you sign in with TikTok, approve the connection, and confirm your account."
      connectArea={
        <Button asChild>
          <a
            href={`/api/connect/tiktok?subdomain=${encodeURIComponent(subdomain)}`}
            data-testid="tiktok-connect-link"
          >
            Connect TikTok
          </a>
        </Button>
      }
    />
  );
}
