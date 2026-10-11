'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PALETTE } from '@/lib/theme';
import { ConnectStatusLayout } from '@/components/accounts/connect-status-layout';

export function getConnectErrorCopy(reason?: string | null): {
  title: string;
  description: string;
} {
  if (reason === 'cancelled') {
    return {
      title: 'Connection Canceled',
      description: 'Connection canceled. No changes were made. You can close this tab.',
    };
  }
  if (reason === 'oauth_failed' || reason === 'internal_oauth_error') {
    return {
      title: "Couldn't Connect to Facebook",
      description: "Couldn't connect to Facebook. Check your permissions and try again.",
    };
  }
  return {
    title: 'Connection Link Expired or Invalid',
    description:
      'This single-use Facebook authorization link has expired or is no longer valid. Please generate a fresh link.',
  };
}

export function ConnectErrorView({
  reason,
}: Readonly<{ reason?: string | null | undefined }>) {
  const { title, description } = getConnectErrorCopy(reason);

  return (
    <ConnectStatusLayout
      testId="magic-connect-error"
      iconBg="rgba(246, 70, 93, 0.15)"
      iconBorder="rgba(246, 70, 93, 0.35)"
      iconColor={PALETTE.accent3}
      title={title}
      description={description}
      icon={
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      }
    />
  );
}

function ConnectErrorQueryReader() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  return <ConnectErrorView reason={reason} />;
}

export default function FacebookConnectErrorPage() {
  return (
    <Suspense fallback={<ConnectErrorView />}>
      <ConnectErrorQueryReader />
    </Suspense>
  );
}
