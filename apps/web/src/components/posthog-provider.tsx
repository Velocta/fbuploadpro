'use client';

import React, { useEffect, type ReactNode } from 'react';
import { initPostHog } from '@/lib/posthog';

interface PostHogProviderProps {
  /** Server-provided PostHog project API key (from POSTHOG_KEY env). */
  apiKey: string | undefined;
  /** Server-provided PostHog host (from POSTHOG_HOST env). */
  host: string | undefined;
  children: ReactNode;
}

/**
 * Initializes client-side PostHog error tracking once on mount.
 * The key/host come from server env via props — never from NEXT_PUBLIC_ vars.
 */
export function PostHogProvider({ apiKey, host, children }: Readonly<PostHogProviderProps>) {
  useEffect(() => {
    initPostHog(apiKey, host);
  }, [apiKey, host]);

  return <>{children}</>;
}
