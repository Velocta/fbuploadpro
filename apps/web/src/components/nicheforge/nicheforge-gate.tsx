'use client';

import React from 'react';
import { Card } from '@/components/shared/ui/card';

export function NicheForgeGate() {
  return (
    <div
      data-slot="nicheforge-gate"
      data-testid="nicheforge-gate"
      className="flex flex-col items-center justify-center px-6 py-12"
    >
      <Card className="w-full max-w-120 items-center gap-4 px-6 py-8 text-center">
        <div
          data-slot="nicheforge-gate-icon"
          data-testid="nicheforge-gate-icon"
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" x2="16.65" y1="21" y2="16.65" />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl leading-heading font-semibold text-ink">NicheForge</h1>
          <p data-testid="nicheforge-gate-message" className="max-w-96 text-body text-ink-sub">
            NicheForge is a desktop-only feature. Open FBUploadPro Desktop to run video research.
          </p>
          <p className="max-w-96 text-body text-ink-sub">
            NicheForge studies public videos you choose and reports what makes them work — using your own AI key, on
            your own device.
          </p>
        </div>
      </Card>
    </div>
  );
}
