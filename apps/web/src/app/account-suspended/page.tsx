import type { Metadata } from 'next';

import { Card } from '@/components/shared/ui/card';
import { StatusDot } from '@/components/shared/ui/status-dot';

export const metadata: Metadata = { title: 'Account suspended' };

/**
 * Account suspended — a static, server-rendered terminal state
 * (spec 136 §5.5). Rebuilt on shared/ui primitives: the status line
 * uses the OD-3 research pattern (colour + icon + text via StatusDot)
 * in place of the former luminous-dot preset, and the copy is
 * preserved verbatim (§3.4). No interactive elements, no client JS.
 * Whether the page gains a support action is OD-136-7 — unanswered,
 * so the existing no-action behaviour is preserved.
 */
export default function AccountSuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 text-ink">
      <Card className="w-full max-w-110 items-center gap-0 px-6 py-6 text-center">
        <div className="mb-3 flex items-center justify-center">
          <StatusDot status="critical" label="Account Suspended" />
        </div>
        <h1 className="mb-2 text-xl leading-heading font-bold tracking-h2 text-ink">
          Access Restricted
        </h1>
        <p className="mb-4 text-body leading-body text-ink-sub">
          Your account has been suspended. Please contact support to restore access.
        </p>
      </Card>
    </main>
  );
}
