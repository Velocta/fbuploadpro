'use client';

import React from 'react';
import { SPACING } from '@/lib/theme';
import {
  PlatformCredentialsView,
  PlatformSetupCard,
  SettingsGuideStep,
  GuideDivider,
  MetaDashboardLink,
  type PlatformCredentialsState,
} from '@/components/settings/platform-credentials-view';
import { getPlatformCallbackUrls } from '@/lib/platforms/callback-urls';

export const INSTAGRAM_CREDENTIALS_CONFIG = {
  platform: 'instagram',
  displayName: 'Instagram',
  appIdLabel: 'Instagram App ID',
  appSecretLabel: 'Instagram App Secret',
  testIdPrefix: 'instagram',
  appIdHelper: "You'll find this in your Meta app under Settings → Basic.",
  formStepNumber: 5,
} as const;

export interface InstagramSettingsViewProps {
  subdomain: string;
  initialCredentials?: PlatformCredentialsState | null | undefined;
  initialLoading?: boolean | undefined;
  initialEditMode?: boolean | undefined;
  initialShowDisconnectModal?: boolean | undefined;
}

export function InstagramSetupGuide() {
  return (
    <div
      data-testid="instagram-setup-guide"
      style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}
    >
      <SettingsGuideStep number={1} title="Create your Meta app">
        Open your <MetaDashboardLink testIdPrefix="instagram" /> and choose Create app. Give your app a name, add your
        email address if asked, and choose the option for connecting an Instagram account. When
        your app is ready, you will see its home screen.
      </SettingsGuideStep>
      <GuideDivider />
      <SettingsGuideStep number={2} title="Add Instagram to your app">
        On your app&apos;s home screen, find Instagram in the list of things you can add, and
        choose Set up. Instagram will now appear in the left-hand menu of your app.
      </SettingsGuideStep>
      <GuideDivider />
      <SettingsGuideStep number={3} title="Finish the Instagram sign-in setup">
        Choose Instagram from the left-hand menu and open its settings. Complete the sign-in
        setup there — this is what lets people sign in with their Instagram account and connect
        it here. You do not need to change anything else on that screen.
      </SettingsGuideStep>
      <GuideDivider />
      <SettingsGuideStep number={4} title="Add the sign-in address we show">
        Copy the sign-in address in the “One more step” box below and paste it into the Instagram
        sign-in settings, in the field for addresses that can bring people back after they sign
        in. Save your changes in your app before you carry on.
      </SettingsGuideStep>
    </div>
  );
}

export function InstagramSettingsView({
  subdomain,
  initialCredentials,
  initialLoading,
  initialEditMode,
  initialShowDisconnectModal,
}: Readonly<InstagramSettingsViewProps>) {
  const urls = getPlatformCallbackUrls('instagram');

  return (
    <PlatformCredentialsView
      subdomain={subdomain}
      config={INSTAGRAM_CREDENTIALS_CONFIG}
      initialCredentials={initialCredentials}
      initialLoading={initialLoading}
      initialEditMode={initialEditMode}
      initialShowDisconnectModal={initialShowDisconnectModal}
      setupCard={
        <PlatformSetupCard
          testIdPrefix="instagram"
          description="Add this address to your Meta app so Instagram can bring you back here after you sign in."
          addresses={[
            {
              key: 'signin',
              label: 'Sign-in address',
              url: urls.signInCallback,
              helper:
                'Paste this into the address field in the Instagram sign-in settings in your Meta app.',
            },
          ]}
        />
      }
    >
      <InstagramSetupGuide />
    </PlatformCredentialsView>
  );
}
