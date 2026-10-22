'use client';

import React from 'react';
import { PlatformConnectInfoView } from '@/components/settings/platform-connect-info-view';

export const X_CONNECT_INFO_CONFIG = {
  platform: 'x',
  displayName: 'X',
  testIdPrefix: 'x',
  paragraphs: [
    'You simply sign in with X and approve the connection. There are no keys to create or paste here.',
    'When you are ready, go to Accounts and choose Connect. X will ask you to confirm that you want to connect your account, and when you are done you will be back in your Accounts list.',
  ],
} as const;

export function XSettingsView({ subdomain }: Readonly<{ subdomain: string }>) {
  return <PlatformConnectInfoView subdomain={subdomain} config={X_CONNECT_INFO_CONFIG} />;
}
