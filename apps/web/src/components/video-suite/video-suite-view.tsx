'use client';

import React, { useState, useEffect } from 'react';
import { isDesktopApp } from '@fbuploadpro/contracts';
import { VideoSuiteGate } from './video-suite-gate';
import { VideoSuiteWorkspace } from './video-suite-workspace';

export interface VideoSuiteViewProps {
  subdomain: string;
  forceDesktop?: boolean;
}

/**
 * Gate pattern copied from FdolaStudioView (spec §4.5): mounted guard
 * so there is no server/client hydration flash — server render shows
 * the gate; the desktop workspace appears only after client mount.
 */
export function VideoSuiteView({ subdomain, forceDesktop = false }: Readonly<VideoSuiteViewProps>) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(forceDesktop);

  useEffect(() => {
    const desktop = forceDesktop || isDesktopApp();
    setIsDesktop(desktop);
    setMounted(true);
  }, [forceDesktop]);

  const effectiveIsDesktop = forceDesktop || (mounted && isDesktop);

  return (
    <div data-slot="video-suite-view" data-testid="video-suite-view">
      {effectiveIsDesktop ? <VideoSuiteWorkspace subdomain={subdomain} /> : <VideoSuiteGate />}
    </div>
  );
}
