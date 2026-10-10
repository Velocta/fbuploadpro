import React from 'react';
import { THEME, PALETTE, RADII } from '@/lib/theme';
import { ConnectStatusLayout } from '@/components/accounts/connect-status-layout';

export default function FacebookConnectSuccessPage() {
  return (
    <ConnectStatusLayout
      testId="magic-connect-success"
      iconBg="rgba(46, 189, 133, 0.15)"
      iconBorder="rgba(46, 189, 133, 0.35)"
      iconColor={PALETTE.accent4}
      title="Facebook Account Connected Successfully"
      description="You're all set! You can close this tab and return to your FbUploadPro dashboard."
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
          <polyline points="20 6 9 17 4 12" />
        </svg>
      }
    >
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          borderRadius: RADII.sm,
          fontSize: '0.8125rem',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        Linked to FbUploadPro via Facebook API.
      </div>
    </ConnectStatusLayout>
  );
}
