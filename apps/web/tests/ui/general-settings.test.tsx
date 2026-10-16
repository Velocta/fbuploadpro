/**
 * @file general-settings.test.tsx
 * @description Comprehensive unit and UI integration tests for redesigned GeneralSettingsView and WorkspaceSettingsPage.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '../components/setup';
import { GeneralSettingsView, validateWorkspaceName } from '@/components/settings/general-settings-view';
import WorkspaceSettingsPage from '@/app/tenant/[subdomain]/settings/page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ subdomain: 'shahzebpyc' }),
  useSearchParams: () => new URLSearchParams('tab=general'),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/tenant/shahzebpyc/settings',
}));

describe('Spec 061: Workspace Settings General Tab Redesign', () => {
  describe('Validation Logic (validateWorkspaceName)', () => {
    it('accepts valid workspace names between 3 and 40 characters without leading/trailing spaces', () => {
      expect(validateWorkspaceName('My Workspace')).toBeNull();
      expect(validateWorkspaceName('abc')).toBeNull();
      expect(validateWorkspaceName('A'.repeat(40))).toBeNull();
    });

    it('rejects names shorter than 3 characters', () => {
      expect(validateWorkspaceName('ab')).toBe('Workspace name must be between 3 and 40 characters.');
      expect(validateWorkspaceName('')).toBe('Workspace name must be between 3 and 40 characters.');
    });

    it('rejects names longer than 40 characters', () => {
      expect(validateWorkspaceName('A'.repeat(41))).toBe('Workspace name must be between 3 and 40 characters.');
    });

    it('rejects names with leading or trailing whitespace', () => {
      expect(validateWorkspaceName(' workspace')).toBe(
        'Workspace name must not contain leading or trailing spaces.'
      );
      expect(validateWorkspaceName('workspace ')).toBe(
        'Workspace name must not contain leading or trailing spaces.'
      );
      expect(validateWorkspaceName('  spaced  ')).toBe(
        'Workspace name must not contain leading or trailing spaces.'
      );
    });
  });

  describe('Page Header & Tab Bar Verification', () => {
    it('renders exact page header "Settings" and "Manage Settings" verbatim', () => {
      const { hasText } = render(<WorkspaceSettingsPage />);
      expect(hasText('Settings')).toBe(true);
      expect(hasText('Manage Settings')).toBe(true);
    });

    it('preserves General and Facebook tabs', () => {
      const { hasText, hasAttribute } = render(<WorkspaceSettingsPage />);
      expect(hasText('General')).toBe(true);
      expect(hasText('Facebook')).toBe(true);
      expect(hasAttribute('data-testid', 'settings-tab-general')).toBe(true);
      expect(hasAttribute('data-testid', 'settings-tab-byoc')).toBe(true);
    });
  });

  describe('Single Card UI & Content Fidelity', () => {
    it('renders strictly ONE card with exact copy and zero legacy metadata', () => {
      const { hasText, hasAttribute, html } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );

      // Verify card existence and testid
      expect(hasAttribute('data-testid', 'workspace-about-card')).toBe(true);
      expect(hasAttribute('data-testid', 'workspace-name-display')).toBe(true);
      expect(hasAttribute('data-testid', 'workspace-name-edit-btn')).toBe(true);

      // Exact copy assertions
      expect(hasText('About this workspace')).toBe(true);
      expect(hasText('Name your workspace.')).toBe(true);
      expect(hasText('WORKSPACE NAME')).toBe(true);
      expect(hasText('shahzebpyc')).toBe(true);
      expect(hasText('Edit')).toBe(true);
      expect(hasText('Rename it any time — the new name shows up everywhere.')).toBe(true);

      // Verify complete elimination of legacy elements
      expect(hasText('Workspace Overview')).toBe(false);
      expect(hasText('Dedicated Subdomain')).toBe(false);
      expect(hasText('shahzebpyc.fbuploadpro.com')).toBe(false);
      expect(hasText('Status')).toBe(false);
      expect(hasText('Active')).toBe(false);
      expect(hasText('Created')).toBe(false);
      expect(hasText('Owner')).toBe(false);
      expect(hasText('Danger Zone')).toBe(false);
      expect(html).not.toContain('status-dot');
    });

    it('contains strictly zero emojis anywhere in rendered text', () => {
      const { html } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );
      // Regex checking for common emoji ranges
      const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(html)).toBe(false);
    });
  });

  describe('Inline Edit, Validation & Toast Rendering', () => {
    it('renders inline text input with Save and Cancel buttons in editing mode', () => {
      const { hasAttribute, hasText, html } = render(
        <GeneralSettingsView
          subdomain="shahzebpyc"
          workspaceName="shahzebpyc"
          initialIsEditing={true}
        />
      );

      expect(hasAttribute('data-testid', 'workspace-name-input')).toBe(true);
      expect(hasAttribute('data-testid', 'workspace-name-save-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'workspace-name-cancel-btn')).toBe(true);
      expect(hasText('Save')).toBe(true);
      expect(hasText('Cancel')).toBe(true);
      expect(hasAttribute('data-testid', 'workspace-name-edit-btn')).toBe(false);
    });

    it('renders validation error message when error is present', () => {
      const { hasAttribute, hasText } = render(
        <GeneralSettingsView
          subdomain="shahzebpyc"
          workspaceName="shahzebpyc"
          initialIsEditing={true}
          initialError="Workspace name must be between 3 and 40 characters."
        />
      );

      expect(hasAttribute('data-testid', 'workspace-name-error')).toBe(true);
      expect(hasText('Workspace name must be between 3 and 40 characters.')).toBe(true);
    });

    it('renders success toast when toast message is present', () => {
      const { hasAttribute, hasText } = render(
        <GeneralSettingsView
          subdomain="shahzebpyc"
          workspaceName="shahzebpyc"
          initialToast="Workspace name updated."
        />
      );

      expect(hasAttribute('data-testid', 'workspace-name-toast')).toBe(true);
      expect(hasText('Workspace name updated.')).toBe(true);
      expect(hasAttribute('data-testid', 'workspace-toast-dismiss-btn')).toBe(true);
    });
  });
});
