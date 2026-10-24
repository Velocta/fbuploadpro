'use client';

import React, { useEffect, useState } from 'react';
import { isDesktopApp } from '@fbuploadpro/contracts';
import { NicheForgeGate } from './nicheforge-gate';
import { NicheForgeWorkspace } from './nicheforge-workspace';
import type { NicheforgeBridge } from '@/lib/nicheforge/bridge-adapter';

export interface NicheForgeViewProps {
  subdomain: string;
  forceDesktop?: boolean;
  /** Test injection only; production uses the Tauri bridge. */
  bridge?: NicheforgeBridge;
}

export function NicheForgeView({ subdomain: _subdomain, forceDesktop = false, bridge }: Readonly<NicheForgeViewProps>) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(forceDesktop);

  useEffect(() => {
    const desktop = forceDesktop || isDesktopApp();
    setIsDesktop(desktop);
    setMounted(true);
  }, [forceDesktop]);

  const effectiveIsDesktop = forceDesktop || (mounted && isDesktop);

  return (
    <div data-slot="nicheforge-view" data-testid="nicheforge-view">
      {effectiveIsDesktop ? (
        bridge ? (
          <NicheForgeWorkspace bridge={bridge} />
        ) : (
          <NicheForgeWorkspace />
        )
      ) : (
        <NicheForgeGate />
      )}
    </div>
  );
}
