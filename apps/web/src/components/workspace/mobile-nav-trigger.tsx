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
      data-slot="sidebar-trigger"
      data-sidebar="trigger"
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
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        color: `var(--text-main, ${THEME.default.text.primary})`,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.15s ease',
        boxSizing: 'border-box',
        outline: 'none',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </svg>
    </button>
  );
}
