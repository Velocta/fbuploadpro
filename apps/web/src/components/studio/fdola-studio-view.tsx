'use client';

import React, { useState, useEffect } from 'react';
import { isDesktopApp } from '@fbuploadpro/contracts';
import { FdolaStudioGate } from './fdola-studio-gate';
import { FdolaStudioWorkspace } from './fdola-studio-workspace';

export interface FdolaStudioViewProps {
  subdomain: string;
  forceDesktop?: boolean;
}

export function FdolaStudioView({ subdomain, forceDesktop = false }: Readonly<FdolaStudioViewProps>) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(forceDesktop);

  useEffect(() => {
    const desktop = forceDesktop || isDesktopApp();
    setIsDesktop(desktop);
    setMounted(true);
  }, [forceDesktop]);

  // If forceDesktop is passed (e.g. testing with renderToStaticMarkup), render immediately
  const effectiveIsDesktop = forceDesktop || (mounted && isDesktop);

  return (
    <div data-slot="fdola-studio-view" data-testid="fdola-studio-view">
      {effectiveIsDesktop ? (
        <FdolaStudioWorkspace subdomain={subdomain} />
      ) : (
        <FdolaStudioGate subdomain={subdomain} />
      )}
    </div>
  );
}
