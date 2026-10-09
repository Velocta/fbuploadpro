'use client';

import React from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { THEME, RADII } from '@/lib/theme';

export function MobileNavTrigger() {
  const { toggleSidebar, openMobile } = useSidebar();

  // If mobile drawer is already open, hide the trigger button
  if (openMobile) {
    return null;
  }

  return (
    <button
      type="button"
      className="mobile-only"
      data-testid="mobile-nav-trigger"
      aria-label="Open navigation menu"
      onClick={toggleSidebar}
      style={{
        position: 'fixed',
        top: '12px',
        left: '12px',
        zIndex: 35,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: RADII.sm,
        backgroundColor: THEME.default.surfaces.panel,
        border: `1px solid ${THEME.default.borders.hairline}`,
        boxShadow: THEME.default.shadows.card,
        color: THEME.default.text.primary,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.15s ease',
        boxSizing: 'border-box',
        outline: 'none',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="6" y2="6" />
        <line x1="4" x2="20" y1="18" y2="18" />
      </svg>
    </button>
  );
}
