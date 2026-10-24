'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformAccountsShell } from '@/components/accounts/platform-accounts-shell';
import { YouTubeIcon } from '@/components/workspace/platform-nav-config';
import { Button } from '@/components/shared/ui/button';

export default function YouTubeAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformAccountsShell
      platformName="YouTube"
      subdomain={subdomain}
      icon={<YouTubeIcon size={24} />}
      description="You connect your channel through our publishing partner — there is nothing to set up or paste here. When you connect, you sign in with YouTube, approve the connection, and pick your channel."
      connectArea={
        <Button asChild>
          <a
            href={`/api/connect/youtube?subdomain=${encodeURIComponent(subdomain)}`}
            data-testid="youtube-connect-link"
          >
            Connect YouTube
          </a>
        </Button>
      }
    />
  );
}
