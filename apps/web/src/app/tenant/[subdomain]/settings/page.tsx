'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { THEME, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { BYOCSettingsView } from '@/components/settings/byoc-settings-view';

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';

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
          Workspace Settings
        </h1>
        <p
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Configure Meta Developer Application credentials and Bring Your Own Credentials (BYOC).
        </p>
      </div>

      {/* Settings Panel */}
      <div>
        <BYOCSettingsView subdomain={subdomain} />
      </div>
    </div>
  );
}
