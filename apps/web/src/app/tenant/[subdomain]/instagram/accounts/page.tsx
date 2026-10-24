'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformAccountsShell } from '@/components/accounts/platform-accounts-shell';
import { InstagramIcon } from '@/components/workspace/platform-nav-config';
import { ByocGate } from '@/components/connect/byoc-gate';
import { Button } from '@/components/shared/ui/button';

export default function InstagramAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformAccountsShell
      platformName="Instagram"
      subdomain={subdomain}
      icon={<InstagramIcon size={24} />}
      description="Connect your Instagram account to schedule and publish posts from one place. Your workspace uses its own Instagram app details, so your accounts stay yours."
      connectArea={
        <ByocGate platform="instagram" platformName="Instagram" subdomain={subdomain}>
          <Button asChild>
            <a
              href={`/api/connect/instagram?subdomain=${encodeURIComponent(subdomain)}`}
              data-testid="instagram-connect-link"
            >
              Connect Instagram
            </a>
          </Button>
        </ByocGate>
      }
    />
  );
}
