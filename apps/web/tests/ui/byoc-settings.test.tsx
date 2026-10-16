/**
 * @file byoc-settings.test.tsx
 * @description Unit tests for rebuilt Facebook Settings Tab (BYOCSettingsView), GeneralSettingsView,
 * and legacy helpers.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BYOCSettingsView,
  ByocTestFailedModal,
  MetaAppSetupSection,
  saveAndTestBYOC,
} from '@/components/settings/byoc-settings-view';
import { GeneralSettingsView } from '@/components/settings/general-settings-view';
import { render } from '../components/setup';

describe('Settings Views Suite (Facebook Settings & General)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          workspaceId: '11111111-1111-4111-a111-111111111111',
          subdomain: 'acme',
          fbAppId: '123456789012345',
          hasSecret: true,
          status: 'valid',
          lastTestedAt: '2026-10-13T10:00:00Z',
          connectedAt: '2026-10-16T12:00:00Z',
        }),
      })
    );
  });

  describe('GeneralSettingsView', () => {
    it('renders workspace overview with name, dedicated subdomain and active status indicator', () => {
      const { hasText } = render(
        <GeneralSettingsView
          subdomain="acme"
          workspaceName="Acme Media Holdings"
          workspaceId="11111111-1111-4111-a111-111111111111"
          ownerEmail="founder@acme.com"
          createdAt="2026-10-10T12:00:00Z"
        />
      );

      expect(hasText('Workspace Overview')).toBe(true);
      expect(hasText('Acme Media Holdings')).toBe(true);
      expect(hasText('acme.fbuploadpro.com')).toBe(true);
      expect(hasText('Active')).toBe(true);
      expect(hasText('founder@acme.com')).toBe(true);
      expect(hasText('Copy')).toBe(true);
    });
  });

  describe('BYOCSettingsView - State 1 (Not Connected)', () => {
    it('renders loading placeholder when initialLoading is true', () => {
      const { hasText } = render(<BYOCSettingsView subdomain="acme" initialLoading={true} />);
      expect(hasText('Loading credentials configuration...')).toBe(true);
    });

    it('renders Connect Facebook card with Not connected status badge', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={null} />
      );

      expect(hasText('Connect Facebook')).toBe(true);
      expect(hasText('Not connected')).toBe(true);
      expect(hasText('Link your Facebook app to start publishing from this workspace.')).toBe(true);
      expect(hasAttribute('data-testid', 'facebook-settings-card')).toBe(true);
      expect(hasAttribute('data-testid', 'facebook-status-badge')).toBe(true);
    });

    it('renders Step 1 with Meta App Dashboard link', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={null} />
      );

      expect(hasText('Get your app details')).toBe(true);
      expect(hasText('Meta App Dashboard →')).toBe(true);
      expect(hasAttribute('href', 'https://developers.facebook.com')).toBe(true);
      expect(hasText('and copy your App ID and App Secret from Settings → Basic.')).toBe(true);
    });

    it('renders Step 2 with App ID, App Secret, Connect button, and helper text', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={null} />
      );

      expect(hasText('Add them here')).toBe(true);
      expect(hasText('APP ID')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-app-id-input')).toBe(true);
      expect(hasAttribute('placeholder', 'e.g. 123456789012345')).toBe(true);
      expect(hasText("You'll find this in your Meta app under Settings → Basic.")).toBe(true);

      expect(hasText('APP SECRET')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-app-secret-input')).toBe(true);
      expect(hasAttribute('placeholder', 'Enter your App Secret')).toBe(true);
      expect(hasText('Show')).toBe(true);
      expect(hasText('Only you can see this — we keep it safe and never show it again.')).toBe(true);

      expect(hasText('Connect Facebook')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-connect-btn')).toBe(true);
      expect(hasText('We check everything works the moment you connect.')).toBe(true);
    });

    it('renders One more step card with workspace callback URL and Copy button', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={null} />
      );

      expect(hasText('One more step')).toBe(true);
      expect(
        hasText(
          'Add this address to your Meta app so Facebook can bring you back here after you sign in.'
        )
      ).toBe(true);
      expect(hasText('SIGN-IN ADDRESS')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-signin-address')).toBe(true);
      expect(hasText('/api/auth/facebook/callback')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-copy-callback-btn')).toBe(true);
      expect(
        hasText('Paste this into the "Valid OAuth Redirect URIs" field in your Meta app.')
      ).toBe(true);
    });
  });

  describe('BYOCSettingsView - State 2 (Connected)', () => {
    const connectedCreds = {
      workspaceId: '11111111-1111-4111-a111-111111111111',
      subdomain: 'acme',
      fbAppId: '987654321098765',
      hasSecret: true,
      status: 'valid' as const,
      lastTestedAt: '2026-10-16T10:00:00Z',
      connectedAt: '2026-10-16T12:00:00Z',
    };

    it('renders Connected status badge and success subtext', () => {
      const { hasText } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={connectedCreds} />
      );

      expect(hasText('Connect Facebook')).toBe(true);
      expect(hasText('Connected')).toBe(true);
      expect(hasText('Your Facebook app is linked and publishing is ready to go.')).toBe(true);
    });

    it('displays saved App ID with Copy button and masked App Secret with Show toggle', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={connectedCreds} />
      );

      expect(hasText('APP ID')).toBe(true);
      expect(hasText('987654321098765')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-copy-app-id-btn')).toBe(true);

      expect(hasText('APP SECRET')).toBe(true);
      expect(hasText('••••••••••••••••••••••••')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-state2-secret-toggle')).toBe(true);
      expect(hasText('Only you can see this — we keep it safe and never show it again.')).toBe(true);
    });

    it('displays Edit details, Disconnect buttons, and formatted Connected date', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={connectedCreds} />
      );

      expect(hasText('Edit details')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-edit-details-btn')).toBe(true);

      expect(hasText('Disconnect')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-disconnect-btn')).toBe(true);

      expect(hasText('Connected on Oct 16, 2026.')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-connected-date')).toBe(true);
    });

    it('hides One more step card in State 2', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView subdomain="acme" initialCredentials={connectedCreds} />
      );

      expect(hasText('One more step')).toBe(false);
      expect(hasAttribute('data-testid', 'fb-one-more-step-card')).toBe(false);
    });
  });

  describe('BYOCSettingsView - Edit Mode', () => {
    const connectedCreds = {
      workspaceId: '11111111-1111-4111-a111-111111111111',
      subdomain: 'acme',
      fbAppId: '987654321098765',
      hasSecret: true,
      status: 'valid' as const,
      lastTestedAt: '2026-10-16T10:00:00Z',
      connectedAt: '2026-10-16T12:00:00Z',
    };

    it('renders form pre-filled with App ID and reveals One more step card in edit mode', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView
          subdomain="acme"
          initialCredentials={connectedCreds}
          initialEditMode={true}
        />
      );

      expect(hasText('Get your app details')).toBe(true);
      expect(hasText('Add them here')).toBe(true);
      expect(hasAttribute('value', '987654321098765')).toBe(true);
      expect(hasText('Cancel')).toBe(true);
      expect(hasText('One more step')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-one-more-step-card')).toBe(true);
    });
  });

  describe('BYOCSettingsView - Disconnect Confirmation Dialog', () => {
    it('renders disconnect confirmation dialog with verbatim copy when opened', () => {
      const { hasText, hasAttribute } = render(
        <BYOCSettingsView
          subdomain="acme"
          initialCredentials={{
            workspaceId: '11111111-1111-4111-a111-111111111111',
            subdomain: 'acme',
            fbAppId: '123456789012345',
            hasSecret: true,
            status: 'valid',
            lastTestedAt: null,
          }}
          initialShowDisconnectModal={true}
        />
      );

      expect(hasAttribute('data-testid', 'fb-disconnect-modal')).toBe(true);
      expect(hasText('Disconnect Facebook?')).toBe(true);
      expect(
        hasText(
          "We'll remove your App ID and App Secret from this workspace. Your connected accounts and posting will keep working as normal — but you won't be able to reconnect or connect new accounts until you add new details."
        )
      ).toBe(true);
      expect(hasText('Keep connected')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-disconnect-keep-btn')).toBe(true);
      expect(hasText('Disconnect')).toBe(true);
      expect(hasAttribute('data-testid', 'fb-disconnect-confirm-btn')).toBe(true);
    });
  });

  describe('Legacy Helpers Compatibility', () => {
    it('renders ByocTestFailedModal when open is true', () => {
      const { hasText, hasAttribute } = render(
        <ByocTestFailedModal
          open={true}
          message="App ID 12345 not found in Meta Developer portal"
          onClose={() => {}}
        />
      );

      expect(hasAttribute('data-testid', 'byoc-test-failed-modal')).toBe(true);
      expect(hasText('Meta Connection Test Failed')).toBe(true);
      expect(hasText('App ID 12345 not found in Meta Developer portal')).toBe(true);
      expect(hasText('Review Credentials')).toBe(true);
    });

    it('renders MetaAppSetupSection with redirect URI and callback label', () => {
      const { hasText } = render(
        <MetaAppSetupSection
          redirectUri="https://acme.fbuploadpro.com/api/auth/facebook/callback"
          copiedKey={null}
          onCopy={() => {}}
        />
      );

      expect(hasText('One more step')).toBe(true);
      expect(hasText('SIGN-IN ADDRESS')).toBe(true);
      expect(hasText('https://acme.fbuploadpro.com/api/auth/facebook/callback')).toBe(true);
    });

    it('saveAndTestBYOC returns save error when save fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Invalid app secret format' }),
        })
      );

      const result = await saveAndTestBYOC('acme', '123456789012345', 'secret12345');
      expect(result.saveError).toBe('Invalid app secret format');
    });
  });
});
