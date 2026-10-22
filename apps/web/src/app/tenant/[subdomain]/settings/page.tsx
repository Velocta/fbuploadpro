'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { THEME, PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { GeneralSettingsView } from '@/components/settings/general-settings-view';
import { BYOCSettingsView } from '@/components/settings/byoc-settings-view';
import { InstagramSettingsView } from '@/components/settings/instagram-settings-view';
import { ThreadsSettingsView } from '@/components/settings/threads-settings-view';
import { YouTubeSettingsView } from '@/components/settings/youtube-settings-view';
import { XSettingsView } from '@/components/settings/x-settings-view';
import { TikTokSettingsView } from '@/components/settings/tiktok-settings-view';

type SettingsTab = 'general' | 'facebook' | 'instagram' | 'threads' | 'youtube' | 'x' | 'tiktok';

const SETTINGS_TAB_IDS: SettingsTab[] = [
  'general',
  'facebook',
  'instagram',
  'threads',
  'youtube',
  'x',
  'tiktok',
];

/**
 * Resolve a ?tab= value to a tab. The legacy 'byoc' value keeps landing on
 * the Facebook tab so existing links (Accounts, Pages, sign-in redirects)
 * keep working unchanged.
 */
function resolveSettingsTab(param: string | null): SettingsTab {
  if (param === 'byoc') return 'facebook';
  if (param && (SETTINGS_TAB_IDS as string[]).includes(param)) {
    return param as SettingsTab;
  }
  return 'general';
}

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const subdomain = (params?.subdomain as string) || '';
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    resolveSettingsTab(searchParams.get('tab'))
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(resolveSettingsTab(tabParam));
    }
  }, [searchParams]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    router.replace(`/tenant/${subdomain}/settings?tab=${tab}`);
  };

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'threads', label: 'Threads' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'x', label: 'X' },
    { id: 'tiktok', label: 'TikTok' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
        padding: `${SPACING.xl} ${SPACING.xxl}`,
        boxSizing: 'border-box',
        minHeight: '100vh',
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
      }}
    >
      {/* Settings Header */}
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            letterSpacing: TYPOGRAPHY.tracking.h1,
          }}
        >
          Settings
        </h1>
      </div>

      {/* Tabs Navigation Bar */}
      <div
        role="tablist"
        aria-label="Settings sections"
        style={{
          display: 'flex',
          gap: SPACING.lg,
          borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              data-testid={`settings-tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? `2px solid ${PALETTE.primary}` : '2px solid transparent',
                padding: `${SPACING.sm} 0`,
                fontSize: '0.875rem',
                fontWeight: isActive ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
                color: isActive ? `var(--text-main, ${THEME.default.text.primary})` : `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                transition: 'color 0.15s ease, border-color 0.15s ease',
                marginBottom: '-1px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = `var(--text-dim, ${THEME.default.text.muted})`;
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'general' && (
          <GeneralSettingsView subdomain={subdomain} />
        )}
        {activeTab === 'facebook' && (
          <BYOCSettingsView subdomain={subdomain} />
        )}
        {activeTab === 'instagram' && (
          <InstagramSettingsView subdomain={subdomain} />
        )}
        {activeTab === 'threads' && (
          <ThreadsSettingsView subdomain={subdomain} />
        )}
        {activeTab === 'youtube' && (
          <YouTubeSettingsView subdomain={subdomain} />
        )}
        {activeTab === 'x' && (
          <XSettingsView subdomain={subdomain} />
        )}
        {activeTab === 'tiktok' && (
          <TikTokSettingsView subdomain={subdomain} />
        )}
      </div>
    </div>
  );
}
