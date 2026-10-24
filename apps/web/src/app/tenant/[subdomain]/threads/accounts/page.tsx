'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PlatformAccountsShell } from '@/components/accounts/platform-accounts-shell';
import { ThreadsIcon } from '@/components/workspace/platform-nav-config';
import { ByocGate } from '@/components/connect/byoc-gate';
import { Button } from '@/components/shared/ui/button';

export default function ThreadsAccountsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

  return (
    <PlatformAccountsShell
      platformName="Threads"
      subdomain={subdomain}
      icon={<ThreadsIcon size={24} />}
      description="Connect your Threads account to schedule and publish posts from one place. Your workspace uses its own Threads app details, so your accounts stay yours."
      connectArea={
        <ByocGate platform="threads" platformName="Threads" subdomain={subdomain}>
          <Button asChild>
            <a
              href={`/api/connect/threads?subdomain=${encodeURIComponent(subdomain)}`}
              data-testid="threads-connect-link"
            >
              Connect Threads
            </a>
          </Button>
        </ByocGate>
      }
    />
  );
}
