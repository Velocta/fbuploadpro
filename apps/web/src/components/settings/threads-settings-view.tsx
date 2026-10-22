'use client';

import React from 'react';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  PlatformCredentialsView,
  PlatformSetupCard,
  SettingsGuideStep,
  GuideDivider,
  type PlatformCredentialsState,
} from '@/components/settings/platform-credentials-view';
import { getPlatformCallbackUrls } from '@/lib/platforms/callback-urls';

export const THREADS_CREDENTIALS_CONFIG = {
  platform: 'threads',
  displayName: 'Threads',
  appIdLabel: 'Threads App ID',
  appSecretLabel: 'Threads App Secret',
  testIdPrefix: 'threads',
  appIdHelper:
    "You'll find this in the Threads settings of your Meta app — not under Settings → Basic.",
  formStepNumber: 6,
} as const;

export interface ThreadsSettingsViewProps {
  subdomain: string;
  initialCredentials?: PlatformCredentialsState | null | undefined;
  initialLoading?: boolean | undefined;
  initialEditMode?: boolean | undefined;
  initialShowDisconnectModal?: boolean | undefined;
}

function MetaDashboardLink() {
  return (
    <a
      href="https://developers.facebook.com"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="threads-meta-dashboard-link"
      style={{
        color: PALETTE.accent1,
        fontWeight: TYPOGRAPHY.weights.semibold,
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.textDecoration = 'underline';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecoration = 'none';
      }}
    >
      Meta App Dashboard →
    </a>
  );
}

export function ThreadsSetupGuide() {
  return (
    <div
      data-testid="threads-setup-guide"
      style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}
    >
      <SettingsGuideStep number={1} title="Create your Meta app">
        Open your <MetaDashboardLink /> and choose Create app. Give your app a name, add your
        email address if asked, and choose the option for connecting a Threads account. If you
        already have a Meta app for this workspace, you can use that app instead and skip to the
        next step.
      </SettingsGuideStep>
      <GuideDivider />
      <SettingsGuideStep number={2} title="Add Threads to your app">
        On your app&apos;s home screen, find Threads in the list of things you can add, and choose
        Set up. Threads will now appear in the left-hand menu of your app, with its own settings.
      </SettingsGuideStep>
      <GuideDivider />
      <SettingsGuideStep number={3} title="Use the Threads pair, not the main pair">
        Threads has its own App ID and App Secret, and they are different from your app&apos;s main
        App ID and App Secret. You will find the Threads pair in the Threads settings of your app —
        not under Settings → Basic. Using the main pair is the most common reason connecting
        Threads fails, so please double-check you are copying from the Threads settings.
      </SettingsGuideStep>
      <GuideDivider />
      <SettingsGuideStep number={4} title="Add the three addresses we show">
        Copy each of the three addresses in the “One more step” box below and paste it into the
        matching field in the Threads settings of your app: the sign-in callback address, the
        deauthorize callback address, and the data deletion callback address. Threads needs all
        three saved before it will accept your sign-in address, so add all three and save your
        changes.
      </SettingsGuideStep>
      <GuideDivider />
      <SettingsGuideStep number={5} title="Copy your Threads App ID and Threads App Secret">
        Still in the Threads settings of your app, copy the Threads App ID and Threads App Secret.
        Then add them below — we check everything works the moment you connect.
      </SettingsGuideStep>
    </div>
  );
}

export function ThreadsSettingsView({
  subdomain,
  initialCredentials,
  initialLoading,
  initialEditMode,
  initialShowDisconnectModal,
}: Readonly<ThreadsSettingsViewProps>) {
  const urls = getPlatformCallbackUrls('threads');

  return (
    <PlatformCredentialsView
      subdomain={subdomain}
      config={THREADS_CREDENTIALS_CONFIG}
      initialCredentials={initialCredentials}
      initialLoading={initialLoading}
      initialEditMode={initialEditMode}
      initialShowDisconnectModal={initialShowDisconnectModal}
      setupCard={
        <PlatformSetupCard
          testIdPrefix="threads"
          description="Add these three addresses to the Threads settings in your Meta app. Threads needs all three before it will save your sign-in address."
          addresses={[
            {
              key: 'signin',
              label: 'Sign-in callback address',
              url: urls.signInCallback,
              helper:
                'Paste this into the sign-in callback field in the Threads settings of your app.',
            },
            {
              key: 'deauthorize',
              label: 'Deauthorize callback address',
              url: urls.deauthorizeCallback,
              helper:
                'Paste this into the deauthorize callback field in the Threads settings of your app. Threads uses this address if someone removes your app.',
            },
            {
              key: 'data-deletion',
              label: 'Data deletion callback address',
              url: urls.dataDeletionCallback,
              helper:
                'Paste this into the data deletion callback field in the Threads settings of your app. Threads uses this address if someone asks for their information to be deleted.',
            },
          ]}
        />
      }
    >
      <ThreadsSetupGuide />
    </PlatformCredentialsView>
  );
}
