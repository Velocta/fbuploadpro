'use client';

import React from 'react';
import { Card } from '@/components/shared/ui/card';

export interface ClipperGateProps {
  subdomain?: string;
}

/**
 * Desktop-only gate (spec §8). No download URL and no button: no URL has
 * been supplied, and inventing one would be a fake link. The copy states
 * plainly that Clipper runs in the desktop app and that the app is coming
 * soon. Framing modes are described only as centre-crop and original shape.
 */
export function ClipperGate({ subdomain: _subdomain }: Readonly<ClipperGateProps>) {
  return (
    <div
      data-slot="clipper-gate"
      data-testid="clipper-gate"
      className="flex flex-col items-center justify-center px-6 py-12"
    >
      <Card className="w-full max-w-120 items-center gap-4 px-6 py-8 text-center">
        <div
          data-slot="clipper-gate-icon"
          data-testid="clipper-gate-icon"
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
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl leading-heading font-semibold text-ink">Clipper</h1>
          <p data-testid="clipper-gate-message" className="max-w-96 text-body text-ink-sub">
            Clipper runs in the FBUploadPro desktop app.
          </p>
          <p className="max-w-96 text-body text-ink-sub">The desktop app is coming soon.</p>
        </div>
      </Card>
    </div>
  );
}
