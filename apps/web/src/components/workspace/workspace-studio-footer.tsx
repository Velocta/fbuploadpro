'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { buildCentralAppUrl } from '@fbuploadpro/contracts';
import { broadcastAuthEvent } from '@/lib/auth-broadcast';
import { CreateWorkspaceModal } from './create-workspace-modal';

export interface WorkspaceItem {
  id: string;
  name: string;
  subdomain: string;
}

export interface WorkspaceStudioFooterProps {
  subdomain: string;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string | undefined;
  } | undefined;
  onNavigate?: ((href: string) => void) | undefined;
}

export function getMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'WS';
}

export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'U';
}

function clearClientSessionCookies(): void {
  if (typeof document === 'undefined') return;
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;

  document.cookie = `fbup_session=; Max-Age=0; path=/; domain=.${rootDomain}; SameSite=Lax`;
  document.cookie = 'fbup_session=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = `fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${rootDomain}; SameSite=Lax`;
  document.cookie = 'fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

function redirectToLogout(): void {
  if (typeof window === 'undefined') return;
  const targetLoginUrl = buildCentralAppUrl(
    '/login?logout=success',
    window.location.href,
    process.env.NEXT_PUBLIC_ROOT_DOMAIN
  ).toString();

  window.location.href = targetLoginUrl;
}

export function broadcastLogout(): void {
  broadcastAuthEvent({ type: 'LOGOUT' });
}

function resolveActiveWorkspace(workspaces: WorkspaceItem[], currentSubdomain: string): WorkspaceItem {
  return (
    workspaces.find((w) => w.subdomain.toLowerCase() === currentSubdomain.toLowerCase()) || {
      id: 'active',
      name: currentSubdomain,
      subdomain: currentSubdomain,
    }
  );
}

// ----------------------------------------------------------------------------
// Subcomponents (kept small for cognitive complexity compliance <= 15)
// ----------------------------------------------------------------------------

interface PopoverUserHeaderProps {
  displayName: string;
  displayEmail: string;
  userInitials: string;
}

function PopoverUserHeader({ displayName, displayEmail, userInitials }: Readonly<PopoverUserHeaderProps>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: `${SPACING.xs} ${SPACING.sm}`,
      }}
    >
      <div
        data-testid="workspace-user-avatar"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: RADII.sm,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          flexShrink: 0,
        }}
      >
        {userInitials}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </span>
        <span
          style={{
            fontSize: '0.6875rem',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayEmail}
        </span>
      </div>
    </div>
  );
}

interface PopoverWorkspacesListProps {
  workspaces: WorkspaceItem[];
  currentSubdomain: string;
  isSwitching: boolean;
  onSelectWorkspace: (subdomain: string) => void;
  onOpenCreate: () => void;
}

function PopoverWorkspacesList({
  workspaces,
  currentSubdomain,
  isSwitching,
  onSelectWorkspace,
  onOpenCreate,
}: Readonly<PopoverWorkspacesListProps>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div
        style={{
          padding: `${SPACING.xs} ${SPACING.sm}`,
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          textTransform: 'uppercase',
          letterSpacing: TYPOGRAPHY.tracking.caption,
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        Workspaces
      </div>
      {workspaces.map((ws) => {
        const isActive = ws.subdomain.toLowerCase() === currentSubdomain.toLowerCase();
        return (
          <button
            key={ws.id || ws.subdomain}
            type="button"
            role="menuitem"
            data-testid={`workspace-option-${ws.subdomain}`}
            onClick={() => onSelectWorkspace(ws.subdomain)}
            disabled={isSwitching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
              width: '100%',
              padding: `${SPACING.xs} ${SPACING.sm}`,
              borderRadius: RADII.sm,
              border: 'none',
              backgroundColor: isActive
                ? `var(--bg-active, ${THEME.default.surfaces.active})`
                : 'transparent',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              cursor: isSwitching ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              outline: 'none',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: isActive ? PALETTE.primary : `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                color: isActive ? '#000000' : `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.625rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {getMonogram(ws.name || ws.subdomain)}
            </div>
            <span
              style={{
                flex: 1,
                fontSize: '0.8125rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ws.name || ws.subdomain}
            </span>
            {isActive && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={PALETTE.primary}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        );
      })}
      <button
        type="button"
        data-testid="create-workspace-button"
        onClick={onOpenCreate}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          width: '100%',
          padding: `${SPACING.xs} ${SPACING.sm}`,
          borderRadius: RADII.sm,
          border: 'none',
          backgroundColor: 'transparent',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.8125rem',
          outline: 'none',
          transition: 'background-color 0.15s ease',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Create Workspace</span>
      </button>
    </div>
  );
}

export interface PopoverActionsListProps {
  currentSubdomain: string;
  isThemeDark: boolean;
  isSettingsActive: boolean;
  isSigningOut?: boolean;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
}

export function PopoverActionsList({
  isThemeDark,
  isSettingsActive,
  isSigningOut = false,
  onOpenSettings,
  onToggleTheme,
  onSignOut,
}: Readonly<PopoverActionsListProps>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <button
        type="button"
        role="menuitem"
        data-testid="workspace-settings-button"
        aria-current={isSettingsActive ? 'page' : undefined}
        onClick={onOpenSettings}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          width: '100%',
          padding: `${SPACING.xs} ${SPACING.sm}`,
          borderRadius: RADII.sm,
          border: 'none',
          backgroundColor: isSettingsActive
            ? `var(--bg-active, ${THEME.default.surfaces.active})`
            : 'transparent',
          color: `var(--text-main, ${THEME.default.text.primary})`,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.8125rem',
          outline: 'none',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Settings</span>
      </button>

      <button
        type="button"
        role="menuitem"
        data-testid="theme-toggle-button"
        onClick={onToggleTheme}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          width: '100%',
          padding: `${SPACING.xs} ${SPACING.sm}`,
          borderRadius: RADII.sm,
          border: 'none',
          backgroundColor: 'transparent',
          color: `var(--text-main, ${THEME.default.text.primary})`,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.8125rem',
          outline: 'none',
        }}
      >
        {isThemeDark ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
        <span>{isThemeDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      <div
        style={{
          height: '1px',
          backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
          margin: `${SPACING.xs} 0`,
        }}
      />

      <button
        type="button"
        role="menuitem"
        data-testid="logout-button"
        onClick={onSignOut}
        disabled={isSigningOut}
        aria-disabled={isSigningOut ? 'true' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          width: '100%',
          padding: `${SPACING.xs} ${SPACING.sm}`,
          borderRadius: RADII.sm,
          border: 'none',
          backgroundColor: 'transparent',
          color: `var(--signal-critical, ${PALETTE.accent3})`,
          cursor: isSigningOut ? 'not-allowed' : 'pointer',
          opacity: isSigningOut ? 0.6 : 1,
          textAlign: 'left',
          fontSize: '0.8125rem',
          outline: 'none',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main Component: WorkspaceStudioFooter
// ----------------------------------------------------------------------------

export function WorkspaceStudioFooter({
  subdomain,
  user,
  onNavigate,
}: Readonly<WorkspaceStudioFooterProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !isMobile && state === 'collapsed';

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isThemeDark, setIsThemeDark] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([
    {
      id: 'current',
      name: subdomain,
      subdomain,
    },
  ]);
  const menuRef = useRef<HTMLLIElement>(null);

  const displayName = user?.name || subdomain;
  const displayEmail = user?.email || `${subdomain}@fbuploadpro.com`;
  const activeWorkspace = resolveActiveWorkspace(workspaces, subdomain);
  const isSettingsActive = pathname ? pathname.startsWith(`/tenant/${subdomain}/settings`) : false;

  useEffect(() => {
    let isMounted = true;
    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data?.workspaces) && data.workspaces.length > 0) {
            setWorkspaces(data.workspaces);
          }
        }
      } catch {
        // Fallback to active
      }
    }
    void loadWorkspaces();
    return () => {
      isMounted = false;
    };
  }, [subdomain]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const storedTheme =
        typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
      const docTheme = document.documentElement.dataset.theme;
      const activeTheme = storedTheme || docTheme || 'dark';
      setIsThemeDark(activeTheme !== 'light');
      document.documentElement.dataset.theme = activeTheme;
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(activeTheme);
    }
  }, []);

  const handleSelectWorkspace = async (targetSubdomain: string) => {
    if (targetSubdomain.toLowerCase() === subdomain.toLowerCase()) {
      setIsOpen(false);
      return;
    }
    setIsSwitching(true);
    setIsOpen(false);
    try {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: targetSubdomain }),
      });
      if (res.ok) {
        const data = await res.json();
        if (isMobile) setOpenMobile(false);
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          window.location.href = `/tenant/${targetSubdomain}`;
        }
        return;
      }
    } catch {
      // Ignore
    }
    setIsSwitching(false);
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    if (isMobile) setOpenMobile(false);
    const settingsHref = `/tenant/${subdomain}/settings`;
    if (onNavigate) {
      onNavigate(settingsHref);
    } else {
      router.push(settingsHref);
    }
  };

  const handleToggleTheme = () => {
    if (typeof document === 'undefined') return;
    const newTheme = isThemeDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = newTheme;
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(newTheme);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', newTheme);
      }
    } catch {
      // Ignore storage errors
    }
    document.cookie = `fbup_theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
    setIsThemeDark(!isThemeDark);
  };

  const handleSignOut = useCallback(async () => {
    let targetRedirectUrl: string | null = null;
    try {
      setIsSigningOut(true);
      clearClientSessionCookies();
      broadcastLogout();
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST', keepalive: true });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.redirectUrl) {
            targetRedirectUrl = data.redirectUrl;
          }
        }
      } catch {
        // Continue even if network is degraded or offline
      }
    } finally {
      if (targetRedirectUrl && typeof window !== 'undefined') {
        window.location.href = targetRedirectUrl;
      } else {
        redirectToLogout();
      }
    }
  }, []);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem ref={menuRef} style={{ position: 'relative' }}>
          {isOpen && (
            <div
              role="menu"
              aria-label="Workspace and profile"
              data-testid="workspace-switcher-dropdown"
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: 0,
                width: isCollapsed ? '240px' : '100%',
                minWidth: '240px',
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
                boxShadow: `var(--shadow-modal, ${THEME.default.shadows.modal})`,
                padding: SPACING.xs,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING.xs,
              }}
            >
              <PopoverUserHeader
                displayName={displayName}
                displayEmail={displayEmail}
                userInitials={getUserInitials(displayName)}
              />

              <div
                style={{
                  height: '1px',
                  backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                  margin: '2px 0',
                }}
              />

              <PopoverWorkspacesList
                workspaces={workspaces}
                currentSubdomain={subdomain}
                isSwitching={isSwitching}
                onSelectWorkspace={handleSelectWorkspace}
                onOpenCreate={() => {
                  setIsOpen(false);
                  setIsCreateOpen(true);
                }}
              />

              <div
                style={{
                  height: '1px',
                  backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                  margin: '2px 0',
                }}
              />

              <PopoverActionsList
                currentSubdomain={subdomain}
                isThemeDark={isThemeDark}
                isSettingsActive={isSettingsActive}
                isSigningOut={isSigningOut}
                onOpenSettings={handleOpenSettings}
                onToggleTheme={handleToggleTheme}
                onSignOut={handleSignOut}
              />
            </div>
          )}

          <SidebarMenuButton
            size="lg"
            data-testid="workspace-switcher-trigger"
            data-collapsed={isCollapsed ? 'true' : undefined}
            aria-label="Workspace and profile menu"
            aria-haspopup="true"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            tooltip={isCollapsed ? `${activeWorkspace.name} (${displayEmail})` : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? 0 : SPACING.sm,
              padding: isCollapsed ? 0 : `${SPACING.xs} ${SPACING.sm}`,
              height: '48px',
            }}
          >
            {/* Left: Active Monogram Avatar */}
            <div
              data-testid="workspace-user-avatar"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: RADII.sm,
                backgroundColor: PALETTE.primary,
                color: '#000000',
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {getMonogram(activeWorkspace.name || subdomain)}
            </div>

            {/* Middle: Workspace Name + Subtitle (Expanded Only) */}
            {!isCollapsed && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeWorkspace.name || subdomain}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayEmail}
                </span>
              </div>
            )}

            {/* Right: ChevronsUpDown (Expanded Only) */}
            {!isCollapsed && (
              <svg
                data-testid="workspace-user-caret"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  flexShrink: 0,
                  marginLeft: 'auto',
                }}
              >
                <path d="m7 15 5 5 5-5" />
                <path d="m7 9 5-5 5 5" />
              </svg>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(newWs) => {
          setIsCreateOpen(false);
          setWorkspaces((prev) => [...prev, newWs]);
          void handleSelectWorkspace(newWs.subdomain);
        }}
      />
    </>
  );
}
