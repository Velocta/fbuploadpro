'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { THEME, PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { GeneralSettingsView } from '@/components/settings/general-settings-view';
import { BYOCSettingsView } from '@/components/settings/byoc-settings-view';

type SettingsTab = 'general' | 'byoc';

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const subdomain = (params?.subdomain as string) || '';
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'general';
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialTab === 'byoc' ? 'byoc' : 'general'
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab') as SettingsTab | null;
    if (tabParam === 'byoc' || tabParam === 'general') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    router.replace(`/tenant/${subdomain}/settings?tab=${tab}`);
  };

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'byoc', label: 'Facebook BYOC' },
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
        <p
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Manage Settings
        </p>
      </div>

      {/* Tabs Navigation Bar */}
      <div
        role="tablist"
        aria-label="Settings sections"
        style={{
          display: 'flex',
          gap: SPACING.lg,
          borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
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
        {activeTab === 'byoc' && (
          <BYOCSettingsView subdomain={subdomain} />
        )}
      </div>
    </div>
  );
}
