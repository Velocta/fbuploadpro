'use client';

import React from 'react';
import { PlatformConnectInfoView } from '@/components/settings/platform-connect-info-view';

export const YOUTUBE_CONNECT_INFO_CONFIG = {
  platform: 'youtube',
  displayName: 'YouTube',
  testIdPrefix: 'youtube',
  paragraphs: [
    'You connect your YouTube channel through our publishing partner, so there is nothing to set up or paste here.',
    'When you are ready, go to Accounts and choose Connect. You will choose your channel and approve the connection there, and then you can schedule and publish videos from here as normal.',
  ],
} as const;

export function YouTubeSettingsView({ subdomain }: Readonly<{ subdomain: string }>) {
  return <PlatformConnectInfoView subdomain={subdomain} config={YOUTUBE_CONNECT_INFO_CONFIG} />;
}
