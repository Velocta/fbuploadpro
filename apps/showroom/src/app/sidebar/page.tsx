'use client';

import React, { useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@web/components/ui/sidebar';
import { PALETTE, THEME, SPACING, RADII, TYPOGRAPHY, STATUS_SIGNALS } from '@web/lib/theme';

// ============================================================================
// SVG ICONS (Clean inline SVG iconography matching Spec 008 aesthetic)
// ============================================================================

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" x2="21" y1="6" y2="6" />
      <line x1="10" x2="21" y1="12" y2="12" />
      <line x1="10" x2="21" y1="18" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function MoreHorizontalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

// ============================================================================
// INNER SHOWCASE HARNESS
// ============================================================================

function SidebarShowcaseInner({
  themeMode,
  setThemeMode,
  variant,
  setVariant,
}: {
  themeMode: 'dark' | 'light';
  setThemeMode: (mode: 'dark' | 'light') => void;
  variant: 'sidebar' | 'inset' | 'floating';
  setVariant: (variant: 'sidebar' | 'inset' | 'floating') => void;
}) {
  const { state, isMobile, toggleSidebar } = useSidebar();
  const [activeItem, setActiveItem] = useState<string>('publishing-queue');
  const [fbPagesOpen, setFbPagesOpen] = useState<boolean>(true);

  const activeTheme = themeMode === 'light' ? THEME.light : THEME.dark;

  return (
    <>
      <Sidebar variant={variant} collapsible="icon">
        {/* Workspace Brand Header */}
        <SidebarHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, width: '100%' }}>
            {/* Brand Emblem */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: RADII.sm,
                backgroundColor: PALETTE.primary,
                color: PALETTE.background,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: TYPOGRAPHY.weights.heavy,
                fontSize: '0.875rem',
                flexShrink: 0,
              }}
            >
              FB
            </div>

            {state === 'expanded' && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: TYPOGRAPHY.weights.bold,
                    color: activeTheme.text.primary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Vinsmoke Media
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Unboxed 6px luminous operational status dot */}
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: RADII.full,
                      backgroundColor: STATUS_SIGNALS.operational.dot,
                      boxShadow: STATUS_SIGNALS.operational.halo,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: activeTheme.text.secondary,
                    }}
                  >
                    {STATUS_SIGNALS.operational.label}
                  </span>
                </div>
              </div>
            )}
          </div>
        </SidebarHeader>

        {/* Scrollable Navigation Groups */}
        <SidebarContent>
          {/* Group 1: Core Publishing */}
          <SidebarGroup>
            <SidebarGroupLabel>
              Publishing
              <SidebarGroupAction
                aria-label="Create Queue Item"
                onClick={() => alert('New publishing queue action triggered')}
              >
                <PlusIcon />
              </SidebarGroupAction>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeItem === 'dashboard'}
                    onClick={() => setActiveItem('dashboard')}
                    leftIcon={<DashboardIcon />}
                    tooltip="Workspace Dashboard"
                  >
                    Dashboard
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeItem.startsWith('fb-')}
                    onClick={() => {
                      setActiveItem('fb-pages');
                      setFbPagesOpen((prev) => !prev);
                    }}
                    leftIcon={<FacebookIcon />}
                    rightIcon={
                      <span
                        style={{
                          transform: fbPagesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 150ms ease',
                          display: 'inline-flex',
                        }}
                      >
                        <ChevronDownIcon />
                      </span>
                    }
                    tooltip="Facebook Pages & Accounts"
                  >
                    Facebook Pages
                  </SidebarMenuButton>

                  {/* Submenu Hierarchy */}
                  {fbPagesOpen && state === 'expanded' && (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeItem === 'fb-pages'}
                          onClick={() => setActiveItem('fb-pages')}
                        >
                          Connected Pages
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeItem === 'fb-tokens'}
                          onClick={() => setActiveItem('fb-tokens')}
                        >
                          Access Tokens
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={activeItem === 'fb-permissions'}
                          onClick={() => setActiveItem('fb-permissions')}
                        >
                          Permissions Matrix
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeItem === 'media-library'}
                    onClick={() => setActiveItem('media-library')}
                    leftIcon={<MediaIcon />}
                    tooltip="R2 Media Library"
                  >
                    Media Library
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    onClick={() => alert('Media options clicked')}
                    aria-label="Media options"
                  >
                    <MoreHorizontalIcon />
                  </SidebarMenuAction>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeItem === 'publishing-queue'}
                    onClick={() => setActiveItem('publishing-queue')}
                    leftIcon={<QueueIcon />}
                    tooltip="Publishing Scheduler & Queue"
                  >
                    Queue Schedule
                    <SidebarMenuBadge>12</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Group 2: Insights & Performance */}
          <SidebarGroup>
            <SidebarGroupLabel>Analytics</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeItem === 'insights'}
                    onClick={() => setActiveItem('insights')}
                    leftIcon={<AnalyticsIcon />}
                    tooltip="Facebook Insights & Reach"
                  >
                    Page Insights
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Group 3: Preferences & Configuration */}
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeItem === 'settings'}
                    onClick={() => setActiveItem('settings')}
                    leftIcon={<SettingsIcon />}
                    tooltip="Settings & Workspace Preferences"
                  >
                    Settings
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User Account Footer */}
        <SidebarFooter>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: RADII.full,
                backgroundColor: activeTheme.surfaces.hover,
                border: `1px solid ${activeTheme.borders.hairline}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: TYPOGRAPHY.weights.semibold,
                fontSize: '0.8125rem',
                color: activeTheme.text.primary,
                flexShrink: 0,
              }}
            >
              AV
            </div>

            {state === 'expanded' && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: activeTheme.text.primary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Alex Vinsmoke
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: activeTheme.text.muted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  alex@vinsmokemedia.online
                </span>
              </div>
            )}
          </div>
        </SidebarFooter>

        {/* Interactive Expand/Collapse Edge Rail */}
        <SidebarRail />
      </Sidebar>

      {/* Main Inset Canvas */}
      <SidebarInset style={{ backgroundColor: activeTheme.surfaces.canvas, color: activeTheme.text.primary }}>
        {/* Top Control Bar with SidebarTrigger and Showroom Controls */}
        <header
          style={{
            height: '56px',
            borderBottom: `1px solid ${activeTheme.borders.hairline}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${SPACING.lg}`,
            boxSizing: 'border-box',
            backgroundColor: activeTheme.surfaces.panel,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
            <SidebarTrigger />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: TYPOGRAPHY.weights.semibold }}>
                Showroom Inspector: Shared Sidebar Suite
              </span>
              <span style={{ fontSize: '0.6875rem', color: activeTheme.text.muted }}>
                Current State: <strong style={{ color: PALETTE.primary }}>{state.toUpperCase()}</strong>{' '}
                {isMobile ? '(Mobile Mode)' : '(Desktop Mode)'} • Shortcut: <code>Cmd/Ctrl+B</code>
              </span>
            </div>
          </div>

          {/* Interactive Inspection Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            {/* Variant Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: activeTheme.text.muted }}>Variant:</span>
              {(['sidebar', 'inset', 'floating'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    borderRadius: RADII.xs,
                    border: `1px solid ${variant === v ? PALETTE.primary : activeTheme.borders.hairline}`,
                    backgroundColor: variant === v ? activeTheme.surfaces.active : 'transparent',
                    color: variant === v ? PALETTE.primary : activeTheme.text.secondary,
                    cursor: 'pointer',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                borderRadius: RADII.xs,
                border: `1px solid ${activeTheme.borders.hairline}`,
                backgroundColor: activeTheme.surfaces.hover,
                color: activeTheme.text.primary,
                cursor: 'pointer',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              {themeMode === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </header>

        {/* Content Body Displaying Active Route Information */}
        <div style={{ padding: SPACING.xl, flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              maxWidth: '960px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.lg,
            }}
          >
            {/* Overview Card */}
            <div
              style={{
                backgroundColor: activeTheme.surfaces.panel,
                border: `1px solid ${activeTheme.borders.hairline}`,
                borderRadius: RADII.md,
                padding: SPACING.xl,
                boxShadow: activeTheme.shadows.card,
              }}
            >
              <h2
                style={{
                  margin: `0 0 ${SPACING.xs} 0`,
                  fontSize: '1.25rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  letterSpacing: TYPOGRAPHY.tracking.h2,
                }}
              >
                Active View: {activeItem.toUpperCase()}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  color: activeTheme.text.secondary,
                  lineHeight: 1.6,
                }}
              >
                This interactive preview demonstrates the production-grade Shadcn-compatible sidebar component.
                Try clicking the toggle button in the top bar, clicking the rail line on the edge of the sidebar, or pressing{' '}
                <kbd
                  style={{
                    backgroundColor: activeTheme.surfaces.subtle,
                    padding: '2px 6px',
                    borderRadius: RADII.xs,
                    border: `1px solid ${activeTheme.borders.hairline}`,
                    fontSize: '0.75rem',
                  }}
                >
                  Cmd+B
                </kbd>{' '}
                / <kbd
                  style={{
                    backgroundColor: activeTheme.surfaces.subtle,
                    padding: '2px 6px',
                    borderRadius: RADII.xs,
                    border: `1px solid ${activeTheme.borders.hairline}`,
                    fontSize: '0.75rem',
                  }}
                >
                  Ctrl+B
                </kbd>{' '}
                to collapse into an icon rail.
              </p>
            </div>

            {/* Feature Compliance Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: SPACING.md,
              }}
            >
              <div
                style={{
                  backgroundColor: activeTheme.surfaces.panel,
                  border: `1px solid ${activeTheme.borders.hairline}`,
                  borderRadius: RADII.md,
                  padding: SPACING.lg,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: SPACING.xs }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: RADII.full,
                      backgroundColor: STATUS_SIGNALS.operational.dot,
                      boxShadow: STATUS_SIGNALS.operational.halo,
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: TYPOGRAPHY.weights.semibold }}>
                    Theme Token Authority
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: activeTheme.text.muted, lineHeight: 1.5 }}>
                  100% powered by <code>apps/web/src/lib/theme.ts</code>. Zero ad-hoc colors, 1px neutral hairlines, and strict typography metrics.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: activeTheme.surfaces.panel,
                  border: `1px solid ${activeTheme.borders.hairline}`,
                  borderRadius: RADII.md,
                  padding: SPACING.lg,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: SPACING.xs }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: RADII.full,
                      backgroundColor: STATUS_SIGNALS.operational.dot,
                      boxShadow: STATUS_SIGNALS.operational.halo,
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: TYPOGRAPHY.weights.semibold }}>
                    Zero Capsule Pill Badges
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: activeTheme.text.muted, lineHeight: 1.5 }}>
                  Badges use sharp geometric 4px corners with tabular numbers; status uses unboxed 6px luminous dots.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: activeTheme.surfaces.panel,
                  border: `1px solid ${activeTheme.borders.hairline}`,
                  borderRadius: RADII.md,
                  padding: SPACING.lg,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: SPACING.xs }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: RADII.full,
                      backgroundColor: STATUS_SIGNALS.operational.dot,
                      boxShadow: STATUS_SIGNALS.operational.halo,
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: TYPOGRAPHY.weights.semibold }}>
                    Cookie & Shortcut Persistence
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: activeTheme.text.muted, lineHeight: 1.5 }}>
                  Saves <code>sidebar_state</code> to cookie with 7-day expiration and localStorage fallback to prevent SSR layout shifts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  );
}

// ============================================================================
// ROOT SHOWROOM SIDEBAR PREVIEW PAGE
// ============================================================================

export default function ShowroomSidebarPage() {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [variant, setVariant] = useState<'sidebar' | 'inset' | 'floating'>('sidebar');

  return (
    <SidebarProvider>
      <SidebarShowcaseInner
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        variant={variant}
        setVariant={setVariant}
      />
    </SidebarProvider>
  );
}
