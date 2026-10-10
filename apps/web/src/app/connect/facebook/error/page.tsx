import React from 'react';
import { PALETTE } from '@/lib/theme';
import { ConnectStatusLayout } from '@/components/accounts/connect-status-layout';

export default function FacebookConnectErrorPage() {
  return (
    <ConnectStatusLayout
      testId="magic-connect-error"
      iconBg="rgba(246, 70, 93, 0.15)"
      iconBorder="rgba(246, 70, 93, 0.35)"
      iconColor={PALETTE.accent3}
      title="Connection Link Expired or Invalid"
      description="This single-use Facebook authorization link has expired or is no longer valid. Please generate a fresh link."
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
