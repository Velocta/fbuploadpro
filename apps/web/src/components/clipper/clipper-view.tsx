'use client';

import React, { useEffect, useState } from 'react';
import { isDesktopApp } from '@fbuploadpro/contracts';
import { ClipperGate } from './clipper-gate';
import { ClipperWorkspace } from './clipper-workspace';
import type { ClipperBridge } from '@/lib/desktop/clipper-bridge';

export interface ClipperViewProps {
  subdomain: string;
  forceDesktop?: boolean;
  bridge?: ClipperBridge;
}

export function ClipperView({ subdomain, forceDesktop = false, bridge }: Readonly<ClipperViewProps>) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(forceDesktop);

  useEffect(() => {
    const desktop = forceDesktop || isDesktopApp();
    setIsDesktop(desktop);
    setMounted(true);
  }, [forceDesktop]);

  // If forceDesktop is passed (e.g. testing), render immediately.
  const effectiveIsDesktop = forceDesktop || (mounted && isDesktop);

  return (
    <div data-slot="clipper-view" data-testid="clipper-view">
      {effectiveIsDesktop ? (
        <ClipperWorkspace subdomain={subdomain} {...(bridge ? { bridge } : {})} />
      ) : (
        <ClipperGate subdomain={subdomain} />
      )}
    </div>
  );
}
