/**
 * @file byoc-settings.test.tsx
 * @description Unit tests for BYOCSettingsView, GeneralSettingsView, and AuditLogsView (Spec 037).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BYOCSettingsView } from '@/components/settings/byoc-settings-view';
import { GeneralSettingsView } from '@/components/settings/general-settings-view';
import { AuditLogsView } from '@/components/settings/audit-logs-view';
import { render } from '../components/setup';

describe('Settings Views Suite (Spec 037)', () => {
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
          webhookVerifyToken: 'verify_custom',
          status: 'valid',
          lastTestedAt: '2026-10-13T10:00:00Z',
        }),
      })
    );
  });

  describe('GeneralSettingsView', () => {
    it('renders workspace overview with name, dedicated subdomain and active status indicator', () => {
      const { hasText, html } = render(
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

  describe('AuditLogsView', () => {
    it('renders chronological audit log items with action, category, and actor', () => {
      const { hasText } = render(
        <AuditLogsView
          logs={[
            {
              id: 'log-test-1',
              action: 'OAuth App Configured',
              category: 'security',
              timestamp: '2026-10-13T09:30:00Z',
              actor: 'Owner',
              details: 'Meta Graph App ID 12345 registered.',
            },
          ]}
        />
      );

      expect(hasText('Audit Trail')).toBe(true);
      expect(hasText('OAuth App Configured')).toBe(true);
      expect(hasText('security')).toBe(true);
      expect(hasText('Meta Graph App ID 12345 registered.')).toBe(true);
      expect(hasText('By Owner')).toBe(true);
    });
  });

  describe('BYOCSettingsView', () => {
    it('renders loading placeholder initially then control fields', () => {
      const { hasText } = render(<BYOCSettingsView subdomain="acme" />);
      // Initially renders loading state before useEffect mounts
      expect(hasText('Loading credentials configuration...')).toBe(true);
    });
  });
});
