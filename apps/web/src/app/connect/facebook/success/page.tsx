import type { Metadata } from 'next';

import { ConnectStatusLayout } from '@/components/accounts/connect-status-layout';

export const metadata: Metadata = { title: 'Facebook connected' };

export default function FacebookConnectSuccessPage() {
  return (
    <ConnectStatusLayout
      testId="magic-connect-success"
      variant="success"
      title="Facebook Account Connected Successfully"
      description="You're all set! You can close this tab and return to your FbUploadPro dashboard."
    >
      <div className="rounded-sm bg-subtle px-3.5 py-2.5 text-metadata text-ink-dim">
        Linked to FBUploadPro via Facebook.
      </div>
    </ConnectStatusLayout>
  );
}
