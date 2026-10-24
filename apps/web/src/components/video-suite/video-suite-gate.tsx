'use client';

import React from 'react';
import { Card } from '@/components/shared/ui/card';

/**
 * Browser placeholder (spec §4.5). TEXT-ONLY desktop note: no public
 * desktop distribution URL exists at build time (spec §11 Q1
 * unanswered), so there is deliberately NO link here. A dead or
 * placeholder link would be a spec violation.
 */
export function VideoSuiteGate() {
  return (
    <div
      data-slot="video-suite-gate"
      data-testid="video-suite-gate"
      className="flex flex-col items-center justify-center px-6 py-12"
    >
      <Card className="w-full max-w-120 items-center gap-4 px-6 py-8 text-center">
        <div
          data-slot="video-suite-gate-icon"
          data-testid="video-suite-gate-icon"
          className="flex size-12 items-center justify-center rounded-md border border-line bg-active text-primary"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl leading-heading font-semibold text-ink">Video Suite</h1>
          <p data-testid="video-suite-gate-message" className="max-w-96 text-body text-ink-sub">
            Video Suite runs in the FBUploadPro desktop app.
          </p>
          <p data-testid="video-suite-gate-note" className="max-w-96 text-body text-ink-sub">
            Available in the FBUploadPro desktop app — coming soon.
          </p>
        </div>
      </Card>
    </div>
  );
}
