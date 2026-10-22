'use client';

import React from 'react';
import { PlatformConnectInfoView } from '@/components/settings/platform-connect-info-view';

export const TIKTOK_CONNECT_INFO_CONFIG = {
  platform: 'tiktok',
  displayName: 'TikTok',
  testIdPrefix: 'tiktok',
  paragraphs: [
    'You connect your TikTok account through our publishing partner, so there is nothing to set up or paste here.',
    'When you are ready, go to Accounts and choose Connect. You will sign in with TikTok and approve the connection there, and then you can schedule and publish videos from here as normal.',
  ],
} as const;

export function TikTokSettingsView({ subdomain }: Readonly<{ subdomain: string }>) {
  return <PlatformConnectInfoView subdomain={subdomain} config={TIKTOK_CONNECT_INFO_CONFIG} />;
}
