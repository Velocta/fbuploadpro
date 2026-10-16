/**
 * @file byoc-settings.test.tsx
 * @description Unit tests for BYOCSettingsView, GeneralSettingsView, saveAndTestBYOC, and ByocTestFailedModal.
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

describe('Settings Views Suite (BYOC & General)', () => {
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
        }),
      })
    );
  });

  describe('GeneralSettingsView', () => {
    it('renders single card with About this workspace, exact copy and no legacy metadata', () => {
      const { hasText } = render(
        <GeneralSettingsView
          subdomain="acme"
          workspaceName="Acme Media Holdings"
        />
      );

      expect(hasText('About this workspace')).toBe(true);
      expect(hasText('Name your workspace.')).toBe(true);
      expect(hasText('WORKSPACE NAME')).toBe(true);
      expect(hasText('Acme Media Holdings')).toBe(true);
      expect(hasText('Edit')).toBe(true);
      expect(hasText('Rename it any time — the new name shows up everywhere.')).toBe(true);

      // Verify complete absence of legacy metadata
      expect(hasText('Workspace Overview')).toBe(false);
      expect(hasText('Dedicated Subdomain')).toBe(false);
      expect(hasText('acme.fbuploadpro.com')).toBe(false);
      expect(hasText('Status')).toBe(false);
      expect(hasText('Active')).toBe(false);
      expect(hasText('Created')).toBe(false);
    });
  });

  describe('BYOCSettingsView', () => {
    it('renders loading placeholder initially then control fields', () => {
      const { hasText } = render(<BYOCSettingsView subdomain="acme" />);
      // Initially renders loading state before useEffect mounts
      expect(hasText('Loading credentials configuration...')).toBe(true);
    });

    it('does not render Webhook Verify Token field', () => {
      const { hasText, hasAttribute } = render(<BYOCSettingsView subdomain="acme" />);
      expect(hasText('Webhook Verify Token')).toBe(false);
      expect(hasAttribute('data-testid', 'byoc-webhook-token-input')).toBe(false);
    });

    it('validates first-time save requires app secret', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Enter your Facebook App Secret to complete setup.' }),
        })
      );

      const outcome = await saveAndTestBYOC('acme', '123456789012345', '');
      expect(outcome.saveError).toBe('Enter your Facebook App Secret to complete setup.');
    });
  });

  describe('ByocTestFailedModal', () => {
    it('renders null when open is false', () => {
      const { html } = render(
        <ByocTestFailedModal
          open={false}
          message="Meta Graph API rejected credentials"
          onClose={() => {}}
        />
      );
      expect(html).toBe('');
    });

    it('renders failure advisory modal and details when open is true', () => {
      const { hasText, hasAttribute } = render(
        <ByocTestFailedModal
          open={true}
          message="App ID 12345 not found in Meta Developer portal"
          onClose={() => {}}
        />
      );

      expect(hasAttribute('data-testid', 'byoc-test-failed-modal')).toBe(true);
      expect(hasAttribute('data-testid', 'byoc-test-failed-title')).toBe(true);
      expect(hasText('Meta Connection Test Failed')).toBe(true);
      expect(hasText('App ID 12345 not found in Meta Developer portal')).toBe(true);
      expect(hasText('Review Credentials')).toBe(true);
      expect(hasAttribute('data-testid', 'byoc-test-failed-dismiss-btn')).toBe(true);
    });
  });

  describe('saveAndTestBYOC auto-test on save workflow', () => {
    it('returns save error if credentials saving fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Invalid app secret format' }),
        })
      );

      const result = await saveAndTestBYOC('acme', '123456789012345', 'secret12345');
      expect(result.saveError).toBe('Invalid app secret format');
      expect(result.testSuccess).toBeUndefined();
    });

    it('saves credentials and performs automated connection test with success', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            status: 'valid',
            message: 'Successfully verified connection to Meta Graph API.',
            testedAt: '2026-10-13T12:00:00Z',
          }),
        });

      vi.stubGlobal('fetch', mockFetch);

      const result = await saveAndTestBYOC('acme', '123456789012345', 'secret12345');
      expect(result.saveError).toBeUndefined();
      expect(result.testSuccess).toBe(true);
      expect(result.testMessage).toBe('Successfully verified connection to Meta Graph API.');
      expect(result.testedAt).toBe('2026-10-13T12:00:00Z');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('saves credentials and flags failure when automated connection test fails', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            status: 'invalid',
            message: 'Meta Graph API error (101): Invalid App Secret.',
            testedAt: '2026-10-13T12:00:00Z',
          }),
        });

      vi.stubGlobal('fetch', mockFetch);

      const result = await saveAndTestBYOC('acme', '123456789012345', 'badsecret');
      expect(result.saveError).toBeUndefined();
      expect(result.testSuccess).toBe(false);
      expect(result.testMessage).toBe('Meta Graph API error (101): Invalid App Secret.');
      expect(result.testedAt).toBe('2026-10-13T12:00:00Z');
    });
  });

  describe('MetaAppSetupSection', () => {
    it('renders all 5 required Meta permissions and no webhook callback url', () => {
      const { hasText } = render(
        <MetaAppSetupSection
          redirectUri="https://app.fbuploadpro.com/api/auth/facebook/callback"
          copiedKey={null}
          onCopy={() => {}}
        />
      );

      expect(hasText('pages_show_list')).toBe(true);
      expect(hasText('pages_read_engagement')).toBe(true);
      expect(hasText('pages_manage_posts')).toBe(true);
      expect(hasText('pages_manage_engagement')).toBe(true);
      expect(hasText('business_management')).toBe(true);
      expect(hasText('Webhook Callback URL')).toBe(false);
      expect(hasText('api/webhooks/facebook')).toBe(false);
    });
  });
});
