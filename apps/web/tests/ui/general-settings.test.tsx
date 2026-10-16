/**
 * @file general-settings.test.tsx
 * @description Comprehensive unit and UI integration tests for redesigned GeneralSettingsView and WorkspaceSettingsPage.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '../components/setup';
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
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/workspaces' && (!init || init.method === 'GET')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              workspaces: [
                {
                  id: 'ws-1',
                  name: 'shahzebpyc',
                  subdomain: 'shahzebpyc',
                },
              ],
            }),
          });
        }
        if (url === '/api/workspaces' && init?.method === 'PATCH') {
          const body = JSON.parse(init.body as string);
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              workspace: {
                id: 'ws-1',
                name: body.name,
                subdomain: body.subdomain || 'shahzebpyc',
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      })
    );
  });

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

    it('preserves existing General and Facebook BYOC tabs', () => {
      const { hasText, getByTestId } = render(<WorkspaceSettingsPage />);
      expect(hasText('General')).toBe(true);
      expect(hasText('Facebook BYOC')).toBe(true);
      expect(getByTestId('settings-tab-general')).toBeTruthy();
      expect(getByTestId('settings-tab-byoc')).toBeTruthy();
    });
  });

  describe('Single Card UI & Content Fidelity', () => {
    it('renders strictly ONE card with exact copy and zero legacy metadata', () => {
      const { hasText, getByTestId, queryByTestId } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );

      // Verify card existence and testid
      expect(getByTestId('workspace-about-card')).toBeTruthy();

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
      expect(queryByTestId('status-dot')).toBeNull();
    });

    it('contains strictly zero emojis anywhere in rendered text', () => {
      const { container } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );
      const text = container.textContent || '';
      // Regex checking for common emoji ranges
      const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(text)).toBe(false);
    });
  });

  describe('Inline Edit, Cancel, Validation & Save Flow', () => {
    it('clicking Edit converts the display value into an inline text input with Save and Cancel', () => {
      const { getByTestId, queryByTestId } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );

      const editBtn = getByTestId('workspace-name-edit-btn');
      expect(editBtn).toBeTruthy();

      fireEvent.click(editBtn);

      const input = getByTestId('workspace-name-input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.value).toBe('shahzebpyc');

      expect(getByTestId('workspace-name-save-btn')).toBeTruthy();
      expect(getByTestId('workspace-name-cancel-btn')).toBeTruthy();
      expect(queryByTestId('workspace-name-edit-btn')).toBeNull();
    });

    it('clicking Cancel reverts the edit without modifications', () => {
      const { getByTestId, queryByTestId, hasText } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );

      fireEvent.click(getByTestId('workspace-name-edit-btn'));
      const input = getByTestId('workspace-name-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Temporary Name' } });

      fireEvent.click(getByTestId('workspace-name-cancel-btn'));

      expect(queryByTestId('workspace-name-input')).toBeNull();
      expect(getByTestId('workspace-name-display')).toBeTruthy();
      expect(hasText('shahzebpyc')).toBe(true);
      expect(hasText('Temporary Name')).toBe(false);
    });

    it('validates input and prevents save on invalid name', () => {
      const { getByTestId, hasText } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );

      fireEvent.click(getByTestId('workspace-name-edit-btn'));
      const input = getByTestId('workspace-name-input') as HTMLInputElement;

      // Enter short name (< 3 chars)
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.click(getByTestId('workspace-name-save-btn'));

      expect(getByTestId('workspace-name-error')).toBeTruthy();
      expect(hasText('Workspace name must be between 3 and 40 characters.')).toBe(true);

      // Enter name with trailing space
      fireEvent.change(input, { target: { value: 'ValidName ' } });
      fireEvent.click(getByTestId('workspace-name-save-btn'));

      expect(hasText('Workspace name must not contain leading or trailing spaces.')).toBe(true);
    });

    it('saves valid name, updates UI, fires workspace-updated event, and shows success toast', async () => {
      const eventSpy = vi.fn();
      window.addEventListener('workspace-updated', eventSpy);

      const { getByTestId, hasText } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );

      fireEvent.click(getByTestId('workspace-name-edit-btn'));
      const input = getByTestId('workspace-name-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'shahzeb-pro-hub' } });

      fireEvent.click(getByTestId('workspace-name-save-btn'));

      await waitFor(() => {
        expect(hasText('Workspace name updated.')).toBe(true);
        expect(getByTestId('workspace-name-toast')).toBeTruthy();
      });

      expect(hasText('shahzeb-pro-hub')).toBe(true);
      expect(eventSpy).toHaveBeenCalled();
      const customEvent = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(customEvent.detail).toEqual({
        subdomain: 'shahzebpyc',
        name: 'shahzeb-pro-hub',
      });

      window.removeEventListener('workspace-updated', eventSpy);
    });

    it('allows dismissing the success toast', async () => {
      const { getByTestId, hasText, queryByTestId } = render(
        <GeneralSettingsView subdomain="shahzebpyc" workspaceName="shahzebpyc" />
      );

      fireEvent.click(getByTestId('workspace-name-edit-btn'));
      const input = getByTestId('workspace-name-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'shahzeb-media' } });
      fireEvent.click(getByTestId('workspace-name-save-btn'));

      await waitFor(() => {
        expect(hasText('Workspace name updated.')).toBe(true);
      });

      const dismissBtn = getByTestId('workspace-toast-dismiss-btn');
      fireEvent.click(dismissBtn);

      expect(queryByTestId('workspace-name-toast')).toBeNull();
    });
  });
});
