'use client';

/**
 * X tab — connect-info config (spec 135 PR-135-4, spec §5.5).
 *
 * Copy preserved VERBATIM per OD-135-3 (a): the strings below are
 * byte-identical to the shipped text (grep proof in the PR body);
 * only the view's construction changed (tokens/primitives).
 */

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
